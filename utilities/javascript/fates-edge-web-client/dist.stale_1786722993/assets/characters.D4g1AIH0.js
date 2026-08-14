const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/editor.lPPGh53H.js","assets/utils.lBShoim5.js","assets/state.42sFgcOQ.js","assets/rolldown-runtime.BQ-_32WO.js","assets/Toast.DDAtBIAw.js","assets/preload-helper.BATLnrmA.js","assets/talent-effects.CY-tOZj6.js","assets/patrons.Ci1TYIUN.js","assets/discovery.I-q7Uafb.js","assets/talent-editor.DYvzq7je.js","assets/roller.D0W8f2sx.js","assets/wizard.Dg1fFXTx.js"])))=>i.map(i=>d[i]);
import{a as ee,i as u,l as h}from"./utils.lBShoim5.js";import{D as I,b as k,d as te,g as V,j as ne}from"./state.42sFgcOQ.js";import{n as f}from"./Toast.DDAtBIAw.js";import{t as P}from"./preload-helper.BATLnrmA.js";function ie(e,t=40){const n=e?.name||"?",i=n.trim().charAt(0).toUpperCase()||"?",o=String(n).split("").reduce((s,c)=>s*31+c.charCodeAt(0)>>>0,7)%360,r=`<div style="width:${t}px;height:${t}px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:${Math.max(12,Math.round(t*.42))}px;font-weight:700;color:#fff;background:hsl(${o},45%,38%);border:1px solid var(--border);">${u(i)}</div>`;return e?.avatar?`
        <span style="position:relative;display:inline-block;width:${t}px;height:${t}px;flex-shrink:0;">
            ${r}
            <img src="${u(e.avatar)}" alt="${u(n)}" loading="lazy"
                 style="position:absolute;inset:0;width:${t}px;height:${t}px;border-radius:50%;object-fit:cover;border:1px solid var(--border);"
                 onerror="this.style.display='none'" />
        </span>
    `:r}function ae(e,{onEdit:t,onDelete:n,onToggleVTT:i,onRoll:o}){const r=document.createElement("div");r.className="char-item";const s=e.vtt?'<span style="font-size:0.7rem;background:var(--gold);color:#1a141a;padding:0.1rem 0.4rem;border-radius:12px;">VTT</span>':"";r.innerHTML=`
        <div style="display:flex;align-items:center;gap:0.6rem;flex:1;min-width:0;">
            ${ie(e,40)}
            <div style="min-width:0;">
                <div class="name">${u(e.name||"Unnamed")} ${s}</div>
                <div class="meta">${u(e.heritage||"")} · Tier ${e.tier||"I"} · XP ${e.xp||32} · ❤️${e.harm||0} ⚡${e.fatigue||0} 🎲${e.boons||0} · ${(e.bonds||[]).length}B · ${(e.complications||[]).length}C</div>
            </div>
        </div>
        <div class="actions">
            <button class="btn btn-sm ${e.vtt?"btn-green":"btn-primary"}" data-action="toggle-vtt">${e.vtt?"✓ VTT":"💬 Push"}</button>
            <button class="btn btn-sm btn-primary" data-action="edit">✏️</button>
            <button class="btn btn-sm btn-primary" data-action="roll">🎲</button>
            <button class="btn btn-sm btn-danger" data-action="delete">🗑️</button>
        </div>
    `;const c=r.querySelector('[data-action="edit"]'),y=r.querySelector('[data-action="delete"]'),v=r.querySelector('[data-action="toggle-vtt"]'),g=r.querySelector('[data-action="roll"]');return c&&t&&c.addEventListener("click",t),y&&n&&y.addEventListener("click",n),v&&i&&v.addEventListener("click",i),g&&o&&g.addEventListener("click",o),r}var re=["Melee","Ranged","Unarmed","Athletics","Stealth","Endurance","Craft","Sway","Deception","Subterfuge","Performance","Insight","Lore","Investigation","Medicine","Arcana"],w=[{id:"minor",label:"Minor",xpRange:"2–3 XP",min:2,max:3,color:"var(--green)"},{id:"major",label:"Major",xpRange:"4–6 XP",min:4,max:6,color:"var(--gold)"},{id:"prestige",label:"Prestige",xpRange:"7–10 XP",min:7,max:10,color:"var(--purple)"},{id:"epic",label:"Epic",xpRange:"11+ XP",min:11,max:999,color:"var(--red)"}],U=[{id:"passive",label:"Passive",note:"Always on; no action required"},{id:"active",label:"Active",note:"Requires an action or scene focus to use"},{id:"reactive",label:"Reactive",note:"Triggers automatically on a condition"}],G=[{id:"tank",label:"Tank",attr:"Body",icon:"🛡️",desc:"Stand in front, absorb damage, protect allies"},{id:"striker",label:"Striker",attr:"Body or Wits",icon:"⚔️",desc:"Deal damage, eliminate threats, break lines"},{id:"controller",label:"Controller",attr:"Spirit or Presence",icon:"🌀",desc:"Shape the battlefield, impose conditions, manage fear"},{id:"support",label:"Support",attr:"Spirit",icon:"💚",desc:"Heal, remove conditions, transfer burdens"},{id:"utility",label:"Utility",attr:"Wits or Spirit",icon:"🔍",desc:"Gather information, solve puzzles, negotiate with spirits"}],q=[{min:0,max:40,tier:"I",name:"Novice",color:"#8bc34a"},{min:41,max:90,tier:"II",name:"Seasoned",color:"#4caf50"},{min:91,max:150,tier:"III",name:"Veteran",color:"#ff9800"},{min:151,max:220,tier:"IV",name:"Paragon",color:"#e91e63"},{min:221,max:1/0,tier:"V",name:"Mythic",color:"#9c27b0"}],A={none:{label:"None",icon:"",blurb:"No magic path chosen yet."},"free-caster":{label:"Free Caster",icon:"🔥",blurb:"Weaves raw TAGS grammar with no patron — pure will and improvisation. Higher risk, no strings attached."},runekeeper:{label:"Runekeeper",icon:"📖",blurb:"Bound to a single patron through a Thiasos (familiar) or Codex. Steady, reliable Rites and a clear Obligation track."},invoker:{label:"Invoker",icon:"🔯",blurb:"Carries Symbols from multiple patrons at once. Versatile, but rival patrons can cause Cross-Resonance."},cantor:{label:"Cantor",icon:"🎵",blurb:"Sings a patron's Rites as Songs. Pushing a Song advances Corruption toward the Bloom."},summoner:{label:"Summoner",icon:"👁️",blurb:"Binds spirits from the Bestiary and manages the Leash before a spirit breaks free."},witch:{label:"Witch",icon:"🌿",blurb:"Hedge magic worked at Thresholds through Quick Workings and full Rituals, paid in Shadow, Shame, and Identity Strain."},psion:{label:"Psion",icon:"🧠",blurb:"Mind-born power fueled by Mental Strain instead of a patron, tags, or corruption."},monk:{label:"Monk",icon:"🧘",blurb:"A patron-optional path of Breath States, Meditation, and monastic Techniques (Foundation → Working → Signature → Quiet)."},"familiar-only":{label:"Familiar Only",icon:"🦅",blurb:"A bonded animal companion without taking on a full magic path."},"hedge-gifts":{label:"Hedge Gifts",icon:"🍃",blurb:"Small universal Hedge Gifts available to any character — no magic path required."}},D={"white-hound":"mykkiel",ferret:"inquisitor-prime","bronze-hawk":"inquisitor-prime","mechanical-bird":"inquisitor-prime","garden-spider":"inaea","silk-moth":"inaea","gray-mouse":"inaea","fire-salamander":"oath-of-flame-light","phoenix-fledgling":"oath-of-flame-light","brass-beetle":"sacred-geometry","konreh-pieces":"sacred-geometry","bell-frog":"gallows-bell","gray-mouse-courthouse":"gallows-bell","lead-seal":"varnek-karn",knucklebone:"varnek-karn","confessor-mouse":"confessor-beneath-the-bell","bell-cricket":"confessor-beneath-the-bell","letter-mouse":"silent-choir","forgetfulness-moth":"silent-choir",raven:"the-witness",silverfish:"the-witness","bronze-key":"sealed-gate","bell-ward":"sealed-gate"},j={"iron-bound-ledger":"inquisitor-prime","slate-tablet":"inquisitor-prime","frame-loom":"inaea","knotted-cords":"inaea","brass-scroll":"oath-of-flame-light","sun-stone":"oath-of-flame-light","brass-stencils":"sacred-geometry","slate-proofs":"sacred-geometry","court-ledger":"gallows-bell","bronze-bells":"gallows-bell","slate-carvings":"varnek-karn","burial-tablets":"varnek-karn","bell-ringers-log":"confessor-beneath-the-bell","leather-strap":"confessor-beneath-the-bell","locked-journal":"silent-choir","wax-tablets":"silent-choir","loose-leaf-pages":"the-witness",chalkboard:"the-witness","leather-strap-seals":"sealed-gate","iron-rings":"sealed-gate"},oe={mykkiel:{basic:"Sworn Defender",advanced:"Unyielding Vow",master:"The Unbroken Covenant"},"inquisitor-prime":{basic:"Hunter's Instinct",advanced:"Cold Clarity",master:"Absolute Judgment"},inaea:{basic:"Thread-Knot Strike",advanced:"Strand of Inevitability",master:"Weaver's Dominion"},"oath-of-flame-light":{basic:"Oathbound Strength",advanced:"Unwavering Resolve",master:"Avatar of the Oath"},"sacred-geometry":{basic:"Golden Ratio Strike",advanced:"Pattern's Heart",master:"Architect of Reality"},"gallows-bell":{basic:"Judge's Intuition",advanced:"Scales of Balance",master:"Final Arbiter"},"varnek-karn":{basic:"Ancestor's Knuckle",advanced:"Final Testament",master:"Death's Confidant"},"confessor-beneath-the-bell":{basic:"Stitched Silence",advanced:"Sin-Eater's Resilience",master:"The Unburdened Bell"},"silent-choir":{basic:"Silencing Palm",advanced:"Burden Bearer",master:"The Unburdened Confessor"},"the-witness":{basic:"Lingering Trace",advanced:"Shared Burden",master:"Absolute Witness"},"sealed-gate":{basic:"Iron Rebuke",advanced:"Circle of Denial",master:"Threshold Incarnate"}};function X(e){return e?e.thiasos&&D[e.thiasos]?D[e.thiasos]:e.codex&&j[e.codex]?j[e.codex]:null:null}function se(e){if(!e||e.magicPath!=="runekeeper"||e.patron)return e;let t=null;try{t=X(e)}catch(n){console.warn("[Characters] derivePatronFromRunekeeperItems failed for",e?.id,n)}if(t){e.patron=t,oe[t]&&!e.monkTechniques&&(e.monkTechniques={});const n=k(),i=(n.characters||[]).findIndex(o=>o.id===e.id);i>=0&&(n.characters[i].patron=t,I())}return e}function F(e=null){return`
        <div class="magic-paths-reference" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:0.4rem;text-align:left;">
            ${Object.entries(A).filter(([t])=>t!=="none").map(([t,n])=>`
                <div style="padding:0.4rem 0.5rem;border-radius:var(--radius);background:var(--bg2);border:1px solid ${t===e?"var(--gold)":"var(--border)"};">
                    <div style="display:flex;align-items:center;gap:0.3rem;">
                        <span style="font-size:1.1rem;">${n.icon}</span>
                        <strong style="font-size:0.85rem;${t===e?"color:var(--gold);":""}">${u(n.label)}</strong>
                    </div>
                    <div style="font-size:0.7rem;color:var(--text3);margin-top:0.15rem;line-height:1.3;">${u(n.blurb)}</div>
                </div>
            `).join("")}
        </div>
    `}function le(e,t={}){if(!e)return;const{title:n="📚 Magic Paths Reference",highlightId:i=null}=t;e.innerHTML=`
        ${n?`<div style="font-weight:600;color:var(--gold);margin-bottom:0.4rem;">${u(n)}</div>`:""}
        ${F(i)}
    `}var M=null,B=!0,_="all",N=!1;function K(e){M=e,M.innerHTML=`
        <div class="characters-header">
            <div class="flex-between" style="flex-wrap:wrap;gap:0.5rem;">
                <div>
                    <h1 class="page-title" style="margin:0;">👤 Characters</h1>
                    <p class="page-sub" style="margin:0.2rem 0 0;">Create and manage your party. Starting XP: 32 (max 36 with bonds/complications).</p>
                </div>
                <div class="flex" style="gap:0.4rem;flex-wrap:wrap;">
                    <button class="btn btn-gold" id="wizardCharBtn">+ New Character (Wizard)</button>
                    <button class="btn btn-sm" id="openEditorBtn">📝 Blank Editor</button>
                    <button class="btn btn-sm btn-primary" id="openTalentsBtn">🧙‍♂️ Talents</button>
                </div>
            </div>
        </div>
        
        <!-- Party Overview -->
        <div class="panel" id="party-overview-panel" style="margin-bottom:0.8rem;">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;margin-bottom:0.5rem;">
                <h3 style="margin:0;">⚔️ Party Composition</h3>
                <span class="text-muted" style="font-size:0.8rem;" id="party-size"></span>
            </div>
            <div id="party-roles-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:0.4rem;"></div>
        </div>
        
        <!-- Character List -->
        <div class="panel" id="char-list-container">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;margin-bottom:0.5rem;">
                <h3 style="margin:0;">Your Characters</h3>
                <div style="display:flex;gap:0.3rem;font-size:0.8rem;align-items:center;">
                    <span id="char-count" class="text-muted"></span>
                    <span class="text-muted">|</span>
                    <span id="xp-summary" class="text-muted"></span>
                </div>
            </div>
            <div class="char-list" id="char-list"></div>
        </div>
        
        <!-- Talent Catalog -->
        <div class="panel" id="talent-panel" style="position:relative;">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;">
                <div style="display:flex;align-items:center;gap:0.5rem;">
                    <h3 style="margin:0;">🧠 Talent Catalog</h3>
                    <span class="text-muted" style="font-size:0.7rem;" id="talent-count"></span>
                </div>
                <div style="display:flex;gap:0.3rem;">
                    <button class="btn btn-sm btn-ghost" id="talent-toggle-btn" title="Toggle talent list visibility">−</button>
                    <button class="btn btn-sm btn-ghost" id="talent-add-btn" title="Add custom talent">+ Talent</button>
                    <button class="btn btn-sm btn-ghost" id="talent-clone-all-btn" title="Clone all talents from the wiki that are not yet cloned" style="color:var(--gold);">📋 Clone All</button>
                </div>
            </div>
            
            <!-- Talent Tier Filter -->
            <div style="display:flex;gap:0.3rem;flex-wrap:wrap;margin-top:0.5rem;" id="talent-filters">
                <button class="btn btn-xs btn-gold talent-filter-btn active" data-filter="all">All</button>
                ${w.map(t=>`<button class="btn btn-xs talent-filter-btn" data-filter="${t.id}" style="border-color:${t.color};">${t.label} (${t.xpRange})</button>`).join("")}
            </div>
            
            <!-- Talent Legend -->
            <div style="font-size:0.7rem;color:var(--text3);margin-top:0.3rem;">
                Minor (2–3 XP): Small situational bonus | Major (4–6 XP): Strong upgrade | Prestige (7–10 XP): Campaign-defining | Epic (11+ XP): Legendary ability
            </div>
            
            <div id="talent-list-container" style="max-height:300px;overflow-y:auto;margin-top:0.5rem;border:1px solid var(--border);border-radius:var(--radius);background:var(--bg2);padding:0.3rem;"></div>
        </div>
    `,L(),z(),T(),Y()}function z(){const e=k().characters||[],t=document.getElementById("party-size");t&&(t.textContent=`${e.length} member${e.length!==1?"s":""}`);const n=document.getElementById("party-roles-grid");if(!n)return;if(e.length===0){n.innerHTML='<div style="grid-column:1/-1;text-align:center;padding:0.5rem;color:var(--text3);font-size:0.85rem;">No characters in party yet.</div>';return}const i=e.map(o=>({char:o,role:Z(o)}));n.innerHTML=G.map(o=>{const r=i.filter(c=>c.role===o.id),s=r.length>0;return`
            <div style="padding:0.4rem 0.5rem;border-radius:var(--radius);background:${s?"rgba(50,255,50,0.05)":"rgba(255,50,50,0.03)"};border:1px solid ${s?"var(--green)":"var(--border)"};font-size:0.8rem;">
                <div style="display:flex;align-items:center;gap:0.3rem;">
                    <span style="font-size:1rem;">${o.icon}</span>
                    <strong>${o.label}</strong>
                    <span style="margin-left:auto;color:var(--text3);font-size:0.7rem;">${o.attr}</span>
                </div>
                <div style="font-size:0.7rem;color:var(--text3);margin-top:0.2rem;">${o.desc}</div>
                ${s?`<div style="margin-top:0.2rem;font-size:0.75rem;color:var(--green);">${r.map(c=>u(c.char.name||"Unnamed")).join(", ")}</div>`:'<div style="margin-top:0.2rem;font-size:0.7rem;color:var(--red);">⚠ No coverage — consider a Follower</div>'}
            </div>
        `}).join("")}function L(){const e=document.getElementById("char-list");if(!e)return;const t=k();let n=t.characters||[];n=n.map(r=>se(r)),t.characters=n;const i=document.getElementById("char-count");i&&(i.textContent=`${n.length} character${n.length!==1?"s":""}`);const o=document.getElementById("xp-summary");if(o)if(n.length>0){const r=n.map(s=>s.totalXp||32).reduce((s,c)=>s+c,0);o.textContent=`Avg XP: ${Math.round(r/n.length)}`}else o.textContent="";if(n.length===0){e.innerHTML=`
            <div class="empty-state" style="text-align:center;padding:2rem;color:var(--text3);">
                <div style="font-size:2rem;margin-bottom:0.5rem;">👤</div>
                <div>No characters yet.</div>
                <div style="font-size:0.8rem;margin-top:0.3rem;">
                    Click "New Character (Wizard)" for guided creation, or "Blank Editor" for the full editor.<br>
                    Starting XP: 32 (max 36 with up to 2 Bonds and 2 Complications).
                </div>
                <div style="margin-top:1rem;text-align:left;">
                    ${F()}
                </div>
            </div>
        `,z();return}e.innerHTML=n.map(r=>{const s=ae(r,{onEdit:()=>{},onDelete:()=>{},onToggleVTT:()=>{},onRoll:()=>{}}),c=document.createElement("div");return c.dataset.charId=r.id,c.appendChild(s),c.outerHTML}).join(""),n.forEach(r=>{const s=e.querySelector(`[data-char-id="${r.id}"]`);if(s){const c=de(r);c&&s.appendChild(c)}}),e.addEventListener("click",ce),z()}function de(e){const t=J(e.totalXp||32),n=e.harm||0,i=e.fatigue||0,o=e.body||1,r=e.boons||0,s=xe(e),c=A[e.magicPath||"none"]||A.none,y=he(e),v=e.totalXp||32,g=Z(e),l=G.find(m=>m.id===g)?.icon||"👤";let d="";if(e.magicPath==="invoker"&&e.symbols?.length&&(d+=` | 🔯 ${e.symbols.map(m=>u(m)).join(", ")}`),e.magicPath==="cantor"){const m=e.corruption||0,b=e.corruptionMax||e.spirit||1,x=$e(m,b),$=e.bloomCount||0,R=e.boundPatron?`bound to ${u(e.boundPatron)}`:"unbound",H=(e.resonantRites||[]).length;d+=` | 🎵 ${m}/${b} (${x})`,d+=` | 🌸 ${$} blooms`,d+=` | ${R}`,H>0&&(d+=` | 🔮 ${H} resonant`)}if(e.magicPath==="witch"){const m=e.shadow||0,b=e.shame||0,x=e.identityStrain||0;d+=` | 🌑 ${m}·${b}·${x}`}if(e.magicPath==="psion"){const m=e.mentalStrain||0,b=e.mentalStrainMax||e.spirit||1;d+=` | 🧠 ${m}/${b}`}if(e.magicPath==="summoner"){const m=(e.boundSpirits||[]).length;m>0&&(d+=` | 👁️ ${m} spirits`)}if(e.magicPath==="monk"||e.monasticTradition){const m=e.breathState||"entering",b=e.monkCorruptionTier||0;d+=` | 🧘 ${m} (T${b})`}if(e.magicPath==="free-caster"){const m=(e.knownTags||[]).length;m>0&&(d+=` | 🔮 ${m} tags`)}if(e.magicPath==="runekeeper"){if(!e.patron){let m=null;try{m=X(e)}catch(b){console.warn("[Characters] derivePatronFromRunekeeperItems failed for",e?.id,b)}if(m){e.patron=m;const b=k(),x=(b.characters||[]).findIndex($=>$.id===e.id);x>=0&&(b.characters[x].patron=m,I())}}e.thiasos&&(d+=` | 🐾 ${u(e.thiasos)}`),e.codex&&(d+=` | 📖 ${u(e.codex)}`),e.patron&&(d+=` | 🔮 ${u(e.patron)}`),e.rites?.length&&(d+=` | 📜 ${e.rites.length} rites`)}const a=document.createElement("div");a.className="char-summary",a.style.cssText="padding:0.4rem 0.6rem;font-size:0.75rem;border-top:1px solid var(--border);display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center;background:var(--bg1);";const p=n===0?"var(--green)":n===1?"var(--gold)":n===2?"var(--orange)":"var(--red)",E=s.doubleCapacity?"var(--red)":s.overCapacity?"var(--orange)":"var(--text2)",S=i>=o?"var(--red)":i>0?"var(--orange)":"var(--text2)";return a.innerHTML=`
        <span style="background:rgba(255,255,255,0.05);padding:0.1rem 0.4rem;border-radius:3px;font-size:0.7rem;" title="Party role">${l} ${g}</span>
        <span style="background:${t.color};color:#000;padding:0.1rem 0.4rem;border-radius:3px;font-weight:600;font-size:0.7rem;" title="Tier based on ${v} XP">T${t.tier} ${t.name}</span>
        <span style="color:var(--text3);" title="Total XP / XP spent">${v} XP ${y!==v?`(${y} spent)`:""}</span>
        <span style="color:var(--text2);" title="Body / Wits / Spirit / Presence"><strong>B</strong>${e.body||1} <strong>W</strong>${e.wits||1} <strong>S</strong>${e.spirit||1} <strong>P</strong>${e.presence||1}</span>
        ${c.icon?`<span title="${c.label}">${c.icon} ${c.label}</span>`:""}
        ${d}
        <span style="color:${p};font-weight:${n>0?"600":"400"};" title="Harm level (0-3)">${n===0?"✓":"💔"} Harm ${n}/3</span>
        <span style="color:${S};" title="Fatigue (max = Body = ${o}). Full → Harm+1, clear">😓 ${i}/${o}</span>
        ${r>0?`<span style="color:var(--gold);" title="Boons (max 5). Spend: re-roll, Position, Asset, 2→1 XP">⭐ ${r}/5</span>`:""}
        ${s.current>0?`<span style="color:${E};" title="Obligation (capacity = Spirit + Presence). Over cap: 1 Fatigue/segment. Double: Patron intrusion">⛓️ ${s.current}/${s.capacity}</span>`:""}
        ${e.vtt?'<span style="color:var(--green);" title="Pushed to VTT">📡</span>':""}
    `,a}function ce(e){const t=e.target.closest("[data-action]");if(!t)return;const n=t.closest("[data-char-id]");if(!n)return;const i=n.dataset.charId;switch(t.dataset.action){case"edit":me(i);break;case"delete":pe(i);break;case"vtt":ue(i);break;case"roll":fe(i)}}function T(){const e=document.getElementById("talent-list-container");if(!e)return;const t=k(),n=t.talents||[],i=(t.wikiEntries||[]).filter(l=>l.tags&&Array.isArray(l.tags)&&l.tags.includes("talent")),o=[...n.map(l=>({...l,isLocal:!0})),...i.map(l=>({...l,name:l.title,description:l.body||l.description,isLocal:!1}))],r={};w.forEach(l=>{r[l.id]=0}),o.forEach(l=>{const d=C(l.cost);r[d.id]!==void 0&&r[d.id]++});const s=n.length+i.length,c=document.getElementById("talent-count");if(c&&(c.textContent=`(${s} total — ${w.map(l=>`${l.label}: ${r[l.id]}`).join(" | ")})`),s===0){e.innerHTML=`
            <div style="text-align:center;padding:0.5rem;color:var(--text3);font-size:0.85rem;">
                No talents defined. Clone from wiki or add custom.<br>
                <span style="font-size:0.75rem;">Talent tiers: Minor (2–3 XP), Major (4–6 XP), Prestige (7–10 XP), Epic (11+ XP)</span>
            </div>
        `;return}let y=n,v=i;if(_!=="all"){const l=w.find(d=>d.id===_);l&&(y=n.filter(d=>{const a=h(d.cost,0);return a>=l.min&&a<=l.max}),v=i.filter(d=>{const a=h(d.cost,0);return a>=l.min&&a<=l.max}))}let g="";if(y.length===0&&v.length===0){g='<div style="text-align:center;padding:0.5rem;color:var(--text3);font-size:0.85rem;">No talents in this tier.</div>',e.innerHTML=g;return}if(y.length>0){const l=[...y].sort((a,p)=>h(a.cost,0)-h(p.cost,0));let d=null;l.forEach(a=>{const p=C(a.cost);p.id!==d&&(d=p.id,g+=`<div style="padding:0.2rem 0.4rem;color:${p.color};font-size:0.7rem;font-weight:600;border-bottom:1px solid var(--border);background:rgba(255,255,255,0.02);">${p.label} (${p.xpRange})</div>`);const E=a.activation||"passive",S=U.find(b=>b.id===E),m=a.prerequisites?` | Req: ${u(a.prerequisites)}`:"";g+=`
                <div class="talent-item" style="display:flex;justify-content:space-between;align-items:center;padding:0.2rem 0.4rem;border-bottom:1px solid var(--border);font-size:0.8rem;gap:0.3rem;">
                    <div style="display:flex;align-items:center;gap:0.4rem;flex:1;min-width:0;">
                        <span style="font-weight:500;white-space:nowrap;">${u(a.name)}</span>
                        <span style="color:${p.color};font-weight:600;font-size:0.7rem;white-space:nowrap;">${a.cost||0}XP</span>
                        ${E!=="passive"?`<span style="font-size:0.65rem;padding:0.05rem 0.2rem;border-radius:2px;background:var(--bg3);color:var(--text3);" title="${S?.note||""}">${E}</span>`:""}
                        ${a.description?`<span style="color:var(--text2);font-size:0.75rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">— ${u(a.description)}</span>`:""}
                        <span style="color:var(--text3);font-size:0.65rem;white-space:nowrap;">${m}</span>
                    </div>
                    <div style="display:flex;gap:0.2rem;flex-shrink:0;">
                        <button class="btn btn-xs btn-ghost talent-edit-btn" data-id="${a.id}" title="Edit">✏️</button>
                        <button class="btn btn-xs btn-ghost talent-delete-btn" data-id="${a.id}" title="Delete" style="color:var(--red);">✕</button>
                    </div>
                </div>
            `})}if(v.length>0){y.length>0&&(g+='<div style="padding:0.2rem 0.4rem;color:var(--text3);font-size:0.7rem;border-bottom:1px solid var(--border);">📚 From Wiki</div>');const l=[...v].sort((a,p)=>h(a.cost,0)-h(p.cost,0));let d=null;l.forEach(a=>{const p=C(a.cost);p.id!==d&&(d=p.id,g+=`<div style="padding:0.2rem 0.4rem;color:${p.color};font-size:0.7rem;font-weight:600;border-bottom:1px solid var(--border);background:rgba(255,255,255,0.02);">${p.label} (${p.xpRange})</div>`),g+=`
                <div class="talent-item wiki-talent" style="display:flex;justify-content:space-between;align-items:center;padding:0.2rem 0.4rem;border-bottom:1px solid var(--border);font-size:0.8rem;gap:0.3rem;">
                    <div style="display:flex;align-items:center;gap:0.4rem;flex:1;min-width:0;">
                        <span style="font-weight:500;color:var(--text2);white-space:nowrap;">${u(a.title)}</span>
                        ${a.cost!=null?`<span style="color:${p.color};font-weight:600;font-size:0.7rem;white-space:nowrap;">${a.cost}XP</span>`:""}
                        ${a.body?`<span style="color:var(--text3);font-size:0.75rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">— ${u(a.body)}</span>`:""}
                        ${a.prerequisites?`<span style="color:var(--text3);font-size:0.65rem;white-space:nowrap;">Req: ${u(a.prerequisites)}</span>`:""}
                    </div>
                    <button class="btn btn-xs btn-ghost talent-clone-btn" data-id="${u(String(a.id))}" title="Clone to local" style="color:var(--green);">📋</button>
                </div>
            `})}e.innerHTML=g,e.querySelectorAll(".talent-edit-btn").forEach(l=>{l.addEventListener("click",d=>{d.stopPropagation(),ge(l.dataset.id)})}),e.querySelectorAll(".talent-delete-btn").forEach(l=>{l.addEventListener("click",d=>{d.stopPropagation(),be(l.dataset.id)})}),e.querySelectorAll(".talent-clone-btn").forEach(l=>{l.addEventListener("click",d=>{d.stopPropagation(),Q(l.dataset.id)})})}function me(e){P(()=>import("./editor.lPPGh53H.js").then(t=>{t.openEditor?t.openEditor(e):f("Editor module not available.","error")}),__vite__mapDeps([0,1,2,3,4,5,6,7,8,9])).catch(()=>{f("Failed to load editor.","error")})}function pe(e){const t=V(e);if(!t)return;const n=J(t.totalXp||32);confirm(`Delete "${t.name||"character"}" (Tier ${n.tier} ${n.name})?`)&&(te(e),L(),f(`"${t.name||"Character"}" deleted.`,"success"))}function ue(e){const t=V(e);if(!t)return;const n=!t.vtt;if(ne(e,{vtt:n})){L(),f(n?`"${t.name||"Character"}" pushed to VTT.`:`"${t.name||"Character"}" removed from VTT.`,"success");const i=document.querySelector('.sidebar-nav button[data-tab="vtt"]');i&&i.click()}}function fe(e){P(()=>import("./roller.D0W8f2sx.js").then(t=>t.r).then(t=>{t.rollForCharacter?t.rollForCharacter(e):f("Roller module not available.","error")}),__vite__mapDeps([10,3,1,2,4,5,6])).catch(()=>{f("Failed to load roller.","error")})}function ge(e){P(()=>import("./talent-editor.DYvzq7je.js").then(t=>{t.openEditor?t.openEditor(e):O(e)}),__vite__mapDeps([9,1,2,3,4,6])).catch(()=>{O(e)})}function O(e){const t=k(),n=t.talents||[],i=n.find(s=>String(s.id)===String(e));if(!i){f("Talent not found.","error");return}const o=document.getElementById("talent-list-container");if(!o)return;const r=o.querySelector(`.talent-edit-btn[data-id="${e}"]`)?.closest(".talent-item");if(r){const s=C(i.cost),c=w.map(a=>`<option value="${a.id}" ${s.id===a.id?"selected":""}>${a.label} (${a.xpRange})</option>`).join(""),y=U.map(a=>`<option value="${a.id}" ${i.activation===a.id?"selected":""}>${a.label}</option>`).join("");r.innerHTML=`
            <div style="padding:0.3rem 0.4rem;width:100%;">
                <div style="display:flex;flex-wrap:wrap;gap:0.3rem;margin-bottom:0.3rem;">
                    <input type="text" id="talent-edit-name" value="${u(i.name)}" style="flex:2;min-width:100px;font-size:0.8rem;" placeholder="Talent name" />
                    <input type="number" id="talent-edit-cost" value="${i.cost||0}" style="width:60px;font-size:0.8rem;" placeholder="XP" min="2" title="XP cost (Minor: 2-3, Major: 4-6, Prestige: 7-10, Epic: 11+)" />
                    <select id="talent-edit-tier" style="width:100px;font-size:0.75rem;" title="Talent tier">${c}</select>
                    <select id="talent-edit-activation" style="width:90px;font-size:0.75rem;" title="Activation type">${y}</select>
                </div>
                <input type="text" id="talent-edit-prereq" value="${u(i.prerequisites||"")}" style="width:100%;font-size:0.75rem;margin-bottom:0.3rem;" placeholder="Prerequisites (e.g., 'Melee 2+, Body 3+')" />
                <input type="text" id="talent-edit-desc" value="${u(i.description||"")}" style="width:100%;font-size:0.75rem;margin-bottom:0.3rem;" placeholder="Description" />
                <div style="display:flex;gap:0.3rem;">
                    <button class="btn btn-xs btn-gold talent-edit-save" data-id="${e}">💾 Save</button>
                    <button class="btn btn-xs talent-edit-cancel" data-id="${e}">✕ Cancel</button>
                </div>
            </div>
        `;const v=r.querySelector("#talent-edit-tier"),g=r.querySelector("#talent-edit-cost");v&&g&&v.addEventListener("change",()=>{const a=w.find(p=>p.id===v.value);if(a){const p=h(g.value,0);(p<a.min||p>a.max)&&(g.value=a.min)}}),setTimeout(()=>{const a=document.getElementById("talent-edit-name");a&&a.focus()},50);const l=r.querySelector(".talent-edit-save");l&&l.addEventListener("click",()=>{const a=document.getElementById("talent-edit-name"),p=document.getElementById("talent-edit-cost"),E=document.getElementById("talent-edit-desc"),S=document.getElementById("talent-edit-prereq"),m=document.getElementById("talent-edit-tier"),b=document.getElementById("talent-edit-activation");if(!a||!a.value.trim()){f("Talent name is required.","error");return}const x=h(p?.value,0),$=w.find(R=>R.id===m?.value);$&&(x<$.min||x>$.max)&&!confirm(`XP cost ${x} doesn't match ${$.label} tier (${$.xpRange}).
Save anyway? (GM may allow custom costs.)`)||(i.name=a.value.trim(),i.cost=x,i.description=E?.value.trim()||"",i.prerequisites=S?.value.trim()||"",i.tier=m?.value||"minor",i.activation=b?.value||"passive",t.talents=n,I(),T(),f(`Talent "${i.name}" updated.`,"success"))});const d=r.querySelector(".talent-edit-cancel");d&&d.addEventListener("click",()=>{T()})}}function be(e){const t=k(),n=t.talents||[],i=n.find(o=>String(o.id)===String(e));i&&confirm(`Delete talent "${i.name}" (${i.cost||0} XP)?`)&&(t.talents=n.filter(o=>String(o.id)!==String(e)),I(),T(),f("Talent deleted.","success"))}function Q(e){const t=k(),n=t.wikiEntries||[];let i;if(typeof e=="string")i=n.find(c=>String(c.id)===String(e)&&c.tags&&Array.isArray(c.tags)&&c.tags.includes("talent"));else if(i=e,!i||!i.tags||!i.tags.includes("talent"))return f("Invalid talent object.","error"),!1;if(!i)return f("Wiki talent not found.","error"),!1;if(t.talents||(t.talents=[]),t.talents.find(c=>c.clonedFrom===i.id||c.source==="wiki-clone"&&c.name===i.title))return!1;const o=h(i.cost,0),r=C(o),s={id:ee("talent_"),name:i.title,cost:o,description:i.body||i.description||"",prerequisites:i.prerequisites||"",source:"wiki-clone",clonedFrom:i.id,tier:i.tier||r.id,activation:i.activation||"passive",createdAt:new Date().toISOString()};return t.talents.push(s),I(),T(),!0}function ve(){const e=k(),t=(e.wikiEntries||[]).filter(s=>s.tags&&Array.isArray(s.tags)&&s.tags.includes("talent"));if(t.length===0){f("No talents found in the wiki.","warning");return}const n=(e.talents||[]).filter(s=>s.source==="wiki-clone"&&s.clonedFrom).map(s=>s.clonedFrom),i=t.filter(s=>!n.includes(s.id));if(i.length===0){f("All wiki talents are already cloned.","info");return}let o=0;const r=i.length;for(const s of i)Q(s)&&o++;o>0?(f(`Cloned ${o}/${r} talents from wiki.`,"success"),T()):f("No new talents were cloned (maybe all are duplicates).","info")}function W(){const e=document.getElementById("talent-list-container"),t=document.getElementById("talent-toggle-btn"),n=document.getElementById("talent-filters"),i=e?.previousElementSibling;!e||!t||(B=!B,B?(e.style.display="block",n&&(n.style.display="flex"),i&&(i.style.display="block"),t.textContent="−",t.title="Collapse talent list"):(e.style.display="none",n&&(n.style.display="none"),i&&(i.style.display="none"),t.textContent="+",t.title="Expand talent list"))}function ye(e){_=e,document.querySelectorAll(".talent-filter-btn").forEach(t=>{t.classList.toggle("active",t.dataset.filter===e),t.classList.toggle("btn-gold",t.dataset.filter===e)}),T()}async function Y(){N||(N=!0,document.addEventListener("click",async e=>{const t=e.target;if(!t.closest("[data-action]")){if(t.id==="wizardCharBtn"||t.closest("#wizardCharBtn")){e.preventDefault();try{const n=await P(()=>import("./wizard.Dg1fFXTx.js"),__vite__mapDeps([11,1,2,3,4,5,7,8]));n.openWizard?n.openWizard():n.default&&n.default.openWizard?n.default.openWizard():f("Wizard module has no openWizard export.","error")}catch(n){f("Failed to load wizard: "+(n.message||n),"error")}}if(t.id==="openEditorBtn"||t.closest("#openEditorBtn")){e.preventDefault();try{const n=await P(()=>import("./editor.lPPGh53H.js"),__vite__mapDeps([0,1,2,3,4,5,6,7,8,9]));n.openEditor?n.openEditor(null):n.default&&typeof n.default=="function"?n.default(null):(f("Editor module loaded but no openEditor export.","error"),console.warn("[Characters] Available exports:",Object.keys(n)))}catch(n){console.error("[Characters] Failed to load editor:",n),f("Failed to load editor: "+(n.message||"unknown error"),"error")}}if(t.id==="openTalentsBtn"||t.closest("#openTalentsBtn")){const n=document.getElementById("talent-panel");n&&(n.scrollIntoView({behavior:"smooth",block:"start"}),B||W()),e.preventDefault()}if((t.id==="talent-toggle-btn"||t.closest("#talent-toggle-btn"))&&(W(),e.preventDefault()),(t.id==="talent-add-btn"||t.closest("#talent-add-btn"))&&(addCustomTalent(),e.preventDefault()),(t.id==="talent-clone-all-btn"||t.closest("#talent-clone-all-btn"))&&(ve(),e.preventDefault()),t.classList?.contains("talent-filter-btn")||t.closest(".talent-filter-btn")){const n=t.closest(".talent-filter-btn");n&&(ye(n.dataset.filter),e.preventDefault())}}}))}function J(e){for(const t of q)if(e>=t.min&&e<=t.max)return t;return q[q.length-1]}function C(e){const t=h(e,0);for(const n of w)if(t>=n.min&&t<=n.max)return n;return w[0]}function Z(e){const t=e.body||1,n=e.wits||1,i=e.spirit||1,o=e.presence||1,r=e.skills||{},s=Math.max(t,n,i,o);return(i>=3||n>=3)&&(r.medicine||0)>=2?"support":(i>=3||o>=3)&&((r.sway||0)>=2||(r.deception||0)>=1)?"controller":(n>=3||i>=3)&&((r.lore||0)>=2||(r.investigation||0)>=1)?"utility":t>=3&&(r.melee||0)>=2&&(r.endurance||0)>=1?"tank":(t>=3||n>=3)&&((r.melee||0)>=2||(r.ranged||0)>=2)?"striker":s===t?"tank":s===n?"utility":s===i?"support":s===o?"controller":"utility"}function he(e){let t=0;for(const n of["body","wits","spirit","presence"]){const i=e[n]||1;for(let o=2;o<=i;o++)t+=o*3}if(e.skills)for(const n of re){const i=e.skills[n.toLowerCase()]||0;for(let o=1;o<=i;o++)t+=o*2}return e.talents&&e.talents.forEach(n=>{t+=h(n.cost,0)}),e.assets&&e.assets.forEach(n=>{t+=h(n.cost,0)}),e.equipment&&e.equipment.forEach(n=>{t+=h(n.cost,0)}),t}function xe(e){const t=(e.spirit||1)+(e.presence||1),n=e.obligation||0;return{capacity:t,current:n,overCapacity:n>t,doubleCapacity:n>t*2}}function $e(e,t){if(e===0)return"Clear";const n=e/t;return n<.25?"Faint":n<.5?"Growing":n<.75?"Pressing":n<1?"Near Bloom":"Bloom"}function we(e){return K(e)}function ke(){M=null}var Pe={render:K,init:we,destroy:ke,renderCharList:L,renderTalentList:T,renderPartyOverview:z,attachEvents:Y,derivePatronFromRunekeeperItems:X,getMagicPathsReferenceHtml:F,renderMagicPathsReference:le,MAGIC_PATHS:A};export{Y as attachEvents,Pe as default,X as derivePatronFromRunekeeperItems,ke as destroy,F as getMagicPathsReferenceHtml,we as init,K as render,L as renderCharList,le as renderMagicPathsReference,z as renderPartyOverview,T as renderTalentList};
