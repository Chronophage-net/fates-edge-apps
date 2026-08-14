import{i as p,l as B}from"./utils.lBShoim5.js";import{D as I,b as $}from"./state.42sFgcOQ.js";import{n as f}from"./Toast.DDAtBIAw.js";import{a as H,i as _}from"./talent-effects.CY-tOZj6.js";var F="/data/talents-manifest.json",U="/data/talents/",k=!1,b=null;async function L(e){try{const t=await fetch(e);return t.ok?await t.json():null}catch(t){return console.warn("[TalentLoader] Failed to fetch",e,t),null}}async function X(e=!1){if(!(k&&!e)){if(b)return b;b=(async()=>{const t=await L(F),i=Array.isArray(t)?t:t?.data||[];if(!i.length){k=!0;return}const a=$();a.talents||(a.talents=[]);const r=new Set(a.talents.map(c=>c.id).filter(Boolean));let s=0;for(const c of i){const d=await L(`${U}${c}.json`);!d||!d.id||r.has(d.id)||(_(d),a.talents.push(d),r.add(d.id),s++)}s>0&&(I(),console.log(`[TalentLoader] Loaded ${s} built-in talent(s) into the catalog.`)),k=!0})();try{await b}finally{b=null}}}function ie(e){if(!Array.isArray(e))return[];const t=new Set;for(const i of e)Array.isArray(i.tags)&&i.tags.forEach(a=>t.add(a));return Array.from(t).sort()}var u=[{id:"minor",label:"Minor",xpRange:"2–3 XP",min:2,max:3,color:"#4caf50",desc:"Small situational bonus, often once per scene. Passive talents provide a constant +1 die or similar edge.",examples:"Keen Senses (+1d perception), Silver Tongue (+1d persuasion), Second Wind (clear 1 Fatigue once/scene)"},{id:"major",label:"Major",xpRange:"4–6 XP",min:4,max:6,color:"#ffc107",desc:"Strong upgrade, permanent effect in a niche. Often defines your character's signature move.",examples:"Weapon Mastery (+2d with chosen weapon), Spellcraft (free casting access), Command Presence (+1d leadership)"},{id:"prestige",label:"Prestige",xpRange:"7–10 XP",min:7,max:10,color:"#e91e63",desc:"Campaign-defining ability that breaks fundamental limits. Often has significant prerequisites.",examples:"Backstab (+1 Harm from stealth), Arcane Dominance (overpower weaker spells), Ghost Heist (crime leaves no evidence)"},{id:"epic",label:"Epic",xpRange:"11+ XP",min:11,max:999,color:"#9c27b0",desc:"Legendary ability that shapes the story. Reserved for high-tier characters.",examples:"Untouchable Form (convert 2 Harm to Fatigue), Absolute Witness (all deceptions fail within Near)"}],M=[{id:"passive",label:"Passive",desc:"Always on; no action required. Stacks with other passive talents.",icon:"🔄"},{id:"active",label:"Active",desc:"Requires an action or scene focus to use. Only one active talent at a time.",icon:"⚡"},{id:"reactive",label:"Reactive",desc:"Triggers automatically on a condition. Only one reactive talent per trigger.",icon:"🔁"}],D=[{id:"general",label:"General",desc:"Universal benefits usable by any character"},{id:"combat",label:"Combat",desc:"Melee, ranged, defense, and battlefield tactics"},{id:"magic-access",label:"Magic Access",desc:"Grants access to a magic path (Spellcraft, Codex, Symbol, etc.)"},{id:"free-caster",label:"Free Caster",desc:"Enhancements for free casting (TAGS system)"},{id:"healer",label:"Healer",desc:"Healing, recovery, and condition removal"},{id:"ranger-tracker",label:"Ranger / Tracker",desc:"Wilderness, tracking, survival, and scouting"},{id:"artificer-crafter",label:"Artificer / Crafter",desc:"Building, repairing, and creating items"},{id:"rogue-thief",label:"Rogue / Thief",desc:"Stealth, theft, infiltration, and criminal skills"},{id:"monk-unarmed",label:"Monk / Unarmed",desc:"Unarmed combat, meditation, and physical discipline"},{id:"cantor-performer",label:"Cantor / Performer",desc:"Songs, performance, and social inspiration"},{id:"follower-asset",label:"Follower & Asset",desc:"Recruitment, management, and delegation"},{id:"defense",label:"Defense",desc:"Guarding, shielding, and damage mitigation"},{id:"movement",label:"Movement",desc:"Charge, skirmish, mounted combat, and mobility"},{id:"social",label:"Social",desc:"Persuasion, deception, networking, and influence"},{id:"investigation",label:"Investigation",desc:"Research, deduction, and information gathering"},{id:"other",label:"Other",desc:"Doesn't fit standard categories"}],G=[{id:"passive",label:"Passive (always on)",desc:"No limit — always active"},{id:"once-scene",label:"Once per scene",desc:"Resets at scene end"},{id:"once-session",label:"Once per session",desc:"Resets after downtime"},{id:"once-arc",label:"Once per arc",desc:"Resets at major story milestones"},{id:"once-campaign",label:"Once per campaign",desc:"One-time use — never refreshes"},{id:"unlimited",label:"Unlimited",desc:"Can be used at any time, no limit"},{id:"custom",label:"Custom",desc:"Special timing defined in description"}],z=[{id:"guide",label:"Player's Guide",desc:"Official talent from the Fate's Edge Player's Guide"},{id:"wiki",label:"Wiki Clone",desc:"Cloned from a wiki entry"},{id:"custom",label:"Custom",desc:"Created by the GM or player"},{id:"homebrew",label:"Homebrew",desc:"Community-created or modified"}],O=`Only one activated talent can be active at a time (for abilities that require a decision or action). 
Passive talents (e.g., +1 die to perception) are always active and stack. 
Active talents that require an action or reaction cannot be used simultaneously — choose which one to activate when the trigger occurs.`,W=`Per scene uses refresh at scene end. 
Per session uses refresh after downtime. 
Some talents allow spending Boons to push effects further.`,y=null,h=null,E=null,g=null;function re(e){K(e)}function oe(e,t=-1){J(e,t)}function K(e){x(),X().catch(()=>{});const t=$();t.talents||(t.talents=[]);let i=null,a=-1;e&&(i=t.talents.find((s,c)=>String(s.id)===String(e)?(a=c,!0):!1));const r=!i;r&&(i={id:N("talent_"),name:"New Talent",cost:2,tier:"minor",activation:"passive",category:"general",tags:[],useLimit:"passive",description:"",prerequisites:"",effect:"",source:"custom"}),g={talentId:i.id,talentIndex:a},j(i,r,"catalog")}function J(e,t){x();const i=$().characters?.find(c=>c.id===e);if(!i){f("Character not found.","error");return}i.talents||(i.talents=[]);const a=t>=0&&t<i.talents.length?i.talents[t]:null,r=!a,s={name:"",cost:2,tier:"minor",activation:"passive",category:"general",tags:[],useLimit:"passive",description:"",prerequisites:"",effect:"",source:"custom"};g={characterId:e,talentIndex:t},j(a||s,r,"character")}function j(e,t,i){E=n=>{n.key==="Escape"&&x()};const a=document.createElement("div");a.className="editor-screen-host",a.id="talent-editor-modal";const r=document.createElement("div");r.className="editor-screen",r.style.maxWidth="700px",r.style.margin="0 auto";const s=u.map(n=>`<option value="${n.id}" ${e.tier===n.id?"selected":""}>${n.label} (${n.xpRange})</option>`).join(""),c=M.map(n=>`<option value="${n.id}" ${e.activation===n.id?"selected":""}>${n.icon} ${n.label} — ${n.desc}</option>`).join(""),d=D.map(n=>`<option value="${n.id}" ${e.category===n.id?"selected":""}>${n.label} — ${n.desc}</option>`).join(""),w=G.map(n=>`<option value="${n.id}" ${e.useLimit===n.id?"selected":""}>${n.label} — ${n.desc}</option>`).join(""),S=z.map(n=>`<option value="${n.id}" ${(e.source||"custom")===n.id?"selected":""}>${n.label}</option>`).join(""),l=u.find(n=>n.id===(e.tier||"minor"))||u[0];r.innerHTML=`
        <button class="btn btn-secondary editor-back" id="talent-editor-close">← Back</button>
        <h2>${t?"➕ Add Talent":"✏️ Edit Talent"}</h2>
        
        <!-- Guide Reference -->
        <details style="margin-bottom:0.8rem;">
            <summary style="cursor:pointer;font-size:0.85rem;color:var(--text2);">📖 Talent Rules Reference</summary>
            <div style="padding:0.5rem;font-size:0.8rem;color:var(--text3);background:var(--bg2);border-radius:6px;margin-top:0.3rem;">
                <p><strong>Talent Tiers:</strong></p>
                ${u.map(n=>`<span style="color:${n.color};">● ${n.label} (${n.xpRange})</span> — ${n.desc}<br>`).join("")}
                <br>
                <p><strong>Activation Types:</strong></p>
                ${M.map(n=>`<strong>${n.icon} ${n.label}:</strong> ${n.desc}<br>`).join("")}
                <br>
                <p><strong>Stacking:</strong> ${O}</p>
                <p><strong>Refresh:</strong> ${W}</p>
                <p><strong>Cost Reminder:</strong> Starting XP is 32 (max 36 with Bonds/Complications). Spend all XP — cannot bank starting XP.</p>
            </div>
        </details>
        
        <form id="talent-editor-form">
            <!-- Name -->
            <div class="form-group">
                <label for="talent-name">Talent Name *</label>
                <input type="text" id="talent-name" value="${p(e.name||"")}" placeholder="e.g., Keen Senses, Weapon Mastery, Backstab" required autofocus />
            </div>
            
            <!-- XP Cost and Tier -->
            <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
                <div class="form-group" style="flex:1;min-width:100px;">
                    <label for="talent-cost">XP Cost</label>
                    <input type="number" id="talent-cost" value="${e.cost??2}" min="2" max="50" 
                        style="font-size:1.1rem;font-weight:600;color:var(--gold);" 
                        title="XP cost. Minor: 2-3, Major: 4-6, Prestige: 7-10, Epic: 11+" />
                    <div id="talent-cost-validation" style="font-size:0.75rem;margin-top:0.2rem;color:var(--green);">
                        ✓ Within ${l.label} range (${l.xpRange})
                    </div>
                </div>
                <div class="form-group" style="flex:1;min-width:140px;">
                    <label for="talent-tier">Talent Tier</label>
                    <select id="talent-tier" style="font-weight:600;">${s}</select>
                    <div id="talent-tier-info" style="font-size:0.75rem;margin-top:0.2rem;color:${l.color};">
                        ${p(l.desc)}
                    </div>
                </div>
            </div>
            
            <!-- Tier Examples -->
            <div id="talent-tier-examples" style="font-size:0.75rem;color:var(--text3);padding:0.3rem 0.5rem;background:var(--bg2);border-radius:4px;margin:0.3rem 0;border-left:3px solid ${l.color};">
                <strong>Examples:</strong> ${p(l.examples)}
            </div>
            
            <!-- Activation and Use Limit -->
            <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
                <div class="form-group" style="flex:1;min-width:150px;">
                    <label for="talent-activation">Activation Type</label>
                    <select id="talent-activation">${c}</select>
                </div>
                <div class="form-group" style="flex:1;min-width:150px;">
                    <label for="talent-use-limit">Use Limit</label>
                    <select id="talent-use-limit">${w}</select>
                </div>
            </div>
            
            <!-- Category and Source -->
            <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
                <div class="form-group" style="flex:1;min-width:150px;">
                    <label for="talent-category">Category</label>
                    <select id="talent-category">${d}</select>
                </div>
                <div class="form-group" style="flex:1;min-width:120px;">
                    <label for="talent-source">Source</label>
                    <select id="talent-source">${S}</select>
                </div>
            </div>
            
            <!-- Tags -->
            <div class="form-group">
                <label for="talent-tags">Tags</label>
                <input type="text" id="talent-tags" value="${p((e.tags||[]).join(", "))}"
                    placeholder="e.g., melee, once-per-scene, stealth, cantor" />
                <div style="font-size:0.75rem;color:var(--text3);margin-top:0.2rem;">
                    Comma-separated. Independent of Category — use tags for cross-cutting traits
                    (skills touched, activation timing, subsystem) so features and filters can key
                    off a talent without depending on its single Category value.
                </div>
            </div>

            <!-- Prerequisites -->
            <div class="form-group">
                <label for="talent-prereq">Prerequisites</label>
                <input type="text" id="talent-prereq" value="${p(e.prerequisites||e.prereq||"")}" 
                    placeholder="e.g., Melee 2+, Body 3+ | Requires: Spellcraft | Requires: Familiar or Patron's Symbol" />
                <div style="font-size:0.75rem;color:var(--text3);margin-top:0.2rem;">
                    Format: Attribute rating (e.g., "Body 3+"), Skill rating (e.g., "Melee 2+"), 
                    Talent required (e.g., "Requires: Spellcraft"), or Tier (e.g., "Requires: Tier II").
                </div>
            </div>
            
            <!-- Effect Summary -->
            <div class="form-group">
                <label for="talent-effect">Effect Summary (mechanical)</label>
                <input type="text" id="talent-effect" value="${p(e.effect||"")}"
                    placeholder="e.g., +1d Stealth | ignore armor penalty | improve Position by 1 step | reroll on a Miss" />
                <div style="font-size:0.75rem;color:var(--text3);margin-top:0.2rem;">
                    Brief mechanical effect for quick reference on character sheets. Patterns like
                    "+1d &lt;skill&gt;", "ignore armor/fatigue/harm penalty", "improve Position by 1 step",
                    and "reroll on a Miss/Partial" are automatically read by the dice roller — no separate
                    setup needed. Anything it can't parse still displays as flavor text.
                </div>
                <div id="talent-effect-preview" style="font-size:0.75rem;margin-top:0.3rem;"></div>
            </div>
            
            <!-- Description -->
            <div class="form-group">
                <label for="talent-description">Full Description</label>
                <textarea id="talent-description" rows="4" 
                    placeholder="Describe the talent in detail — how it works, when to use it, what happens on activation...">${p(e.description||"")}</textarea>
            </div>
            
            <!-- Stacking Notice -->
            <div style="font-size:0.75rem;color:var(--text3);padding:0.3rem 0.5rem;background:rgba(255,193,7,0.08);border-radius:4px;border-left:2px solid var(--gold);margin-bottom:0.5rem;">
                <strong>Stacking:</strong> ${O}
            </div>
            
            <!-- Buttons -->
            <div style="display:flex;gap:0.5rem;margin-top:1rem;flex-wrap:wrap;">
                <button type="submit" class="btn btn-gold">💾 Save Talent</button>
                <button type="button" class="btn" id="talent-editor-cancel">Cancel</button>
                ${t?"":'<button type="button" class="btn btn-danger" id="talent-editor-delete">🗑️ Delete</button>'}
            </div>
        </form>
    `,a.appendChild(r);const m=document.getElementById("app-content")||document.body;h=Array.from(m.children),h.forEach(n=>{n.style.display="none"}),m.appendChild(a),window.scrollTo({top:0}),y=a;const o=()=>x();document.getElementById("talent-editor-close")?.addEventListener("click",o),document.getElementById("talent-editor-cancel")?.addEventListener("click",o),document.addEventListener("keydown",E);const v=document.getElementById("talent-editor-delete");v&&v.addEventListener("click",()=>{const n=e?.name||"Untitled";confirm(`Delete talent "${n}"? This cannot be undone.`)&&(Z(e,i),o())});const T=document.getElementById("talent-tier");T&&T.addEventListener("change",()=>{Y(),A()});const C=document.getElementById("talent-cost");C&&(C.addEventListener("input",A),C.addEventListener("change",A));const P=document.getElementById("talent-editor-form");P&&P.addEventListener("submit",n=>{n.preventDefault(),Q(e,t,i)});const R=document.getElementById("talent-effect");R&&(R.addEventListener("input",q),q())}function V(e){switch(e.type){case"die_bonus":{const t=e.scope==="any"?"all rolls":e.key||e.scope;return`${e.amount>=0?"+":""}${e.amount}d to ${t}`}case"position_shift":return`Position +${e.amount} step${e.amount===1?"":"s"}`;case"ignore_penalty":return`Ignore ${e.amount}d of ${e.source} penalty`;case"reroll":return`Reroll a failing die (${e.trigger.replace("_"," ")})`;default:return e.type}}function q(){const e=document.getElementById("talent-effect-preview"),t=document.getElementById("talent-effect");if(!e||!t)return;const i=H(t.value||"");i.length===0?e.innerHTML=t.value?'<span style="color:var(--text3);">No mechanical effect recognized — will display as flavor text only.</span>':"":e.innerHTML='<span style="color:var(--green);">⚙ Mechanical: '+i.map(a=>p(V(a))).join(", ")+"</span>"}function Y(){const e=document.getElementById("talent-tier")?.value||"minor",t=u.find(s=>s.id===e)||u[0],i=document.getElementById("talent-tier-info");i&&(i.textContent=t.desc,i.style.color=t.color);const a=document.getElementById("talent-tier-examples");a&&(a.innerHTML=`<strong>Examples:</strong> ${p(t.examples)}`,a.style.borderLeftColor=t.color);const r=document.getElementById("talent-cost");if(r){const s=B(r.value,0);(s<t.min||s>t.max)&&(r.value=t.min)}}function A(){const e=document.getElementById("talent-tier")?.value||"minor",t=u.find(r=>r.id===e)||u[0],i=B(document.getElementById("talent-cost")?.value,0),a=document.getElementById("talent-cost-validation");a&&(i<t.min||i>t.max?(a.innerHTML=`⚠ Cost ${i} is outside ${t.label} range (${t.xpRange}). GM may allow custom costs.`,a.style.color="var(--orange)"):(a.innerHTML=`✓ Within ${t.label} range (${t.xpRange})`,a.style.color="var(--green)"))}function Q(e,t,i){const a=document.getElementById("talent-name"),r=a?.value?.trim()||"";if(!r){f("Please enter a talent name.","error"),a&&(a.style.borderColor="var(--red)",a.focus(),setTimeout(()=>a.style.borderColor="",3e3));return}const s=document.getElementById("talent-tier")?.value||"minor",c=u.find(o=>o.id===s)||u[0],d=B(document.getElementById("talent-cost")?.value,c.min);if((d<c.min||d>c.max)&&!confirm(`XP cost ${d} doesn't match ${c.label} tier (${c.xpRange}).

Save anyway? (GM may allow custom costs.)`))return;const w=document.getElementById("talent-effect")?.value?.trim()||"",S=(document.getElementById("talent-tags")?.value||"").split(",").map(o=>o.trim().toLowerCase()).filter(Boolean),l={name:r,description:document.getElementById("talent-description")?.value?.trim()||"",cost:d,tier:s,activation:document.getElementById("talent-activation")?.value||"passive",category:document.getElementById("talent-category")?.value||"general",tags:S,useLimit:document.getElementById("talent-use-limit")?.value||"passive",source:document.getElementById("talent-source")?.value||"custom",prerequisites:document.getElementById("talent-prereq")?.value?.trim()||"",effect:w,effects:H(w)};e.id&&(l.id=e.id),e.source==="wiki-clone"&&(l.source="wiki-clone"),e.clonedFrom&&(l.clonedFrom=e.clonedFrom),e.createdAt&&(l.createdAt=e.createdAt),t&&!l.createdAt&&(l.createdAt=new Date().toISOString());const m=$();if(i==="catalog")if(m.talents||(m.talents=[]),t)l.id=l.id||N("talent_"),m.talents.push(l),f(`✅ Added talent "${r}" (${c.label}, ${d} XP) to catalog`,"success");else{const o=g.talentIndex;o>=0&&o<m.talents.length&&(m.talents[o]={...m.talents[o],...l},f(`✅ Updated talent "${r}" (${c.label}, ${d} XP)`,"success"))}else if(i==="character"){const o=m.characters?.find(T=>T.id===g.characterId);if(!o){f("Character not found.","error");return}o.talents||(o.talents=[]);const v=g.talentIndex;t||v<0?(o.talents.push(l),f(`✅ Added talent "${r}" (${c.label}, ${d} XP) to ${o.name}`,"success")):(o.talents[v]={...o.talents[v],...l},f(`✅ Updated talent "${r}" on ${o.name}`,"success"))}I(),x(),document.dispatchEvent(new CustomEvent("character-updated")),document.dispatchEvent(new CustomEvent("talent-updated"))}function Z(e,t){const i=$();if(t==="catalog"){if(!i.talents)return;const a=g.talentIndex;a>=0&&a<i.talents.length&&(i.talents.splice(a,1),I(),f(`🗑️ Talent "${e.name}" deleted from catalog.`,"success"),document.dispatchEvent(new CustomEvent("character-updated")),document.dispatchEvent(new CustomEvent("talent-updated")))}else if(t==="character"){const a=i.characters?.find(s=>s.id===g.characterId);if(!a||!a.talents)return;const r=g.talentIndex;r>=0&&r<a.talents.length&&(a.talents.splice(r,1),I(),f(`🗑️ Talent "${e.name}" removed from ${a.name}.`,"success"),document.dispatchEvent(new CustomEvent("character-updated")))}}function x(){E&&(document.removeEventListener("keydown",E),E=null),y&&y.parentNode&&y.parentNode.removeChild(y),h&&(h.forEach(e=>{e.style.display=""}),h=null),y=null,g=null}function N(e="talent_"){return e+Date.now().toString(36)+Math.random().toString(36).substring(2,8)}export{D as TALENT_CATEGORIES,X as n,re as openEditor,oe as openTalentEditor,ie as t};
