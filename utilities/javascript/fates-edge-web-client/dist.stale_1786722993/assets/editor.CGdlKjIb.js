const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/encounters.DM8SkZZ1.js","assets/utils.lBShoim5.js","assets/state.42sFgcOQ.js","assets/rolldown-runtime.BQ-_32WO.js","assets/Toast.DDAtBIAw.js","assets/preload-helper.BATLnrmA.js","assets/websocket.Dmklt06W.js","assets/main.hiOZSyFC.js","assets/sync.i5xh8ufD.js","assets/main.DcCFXHiG.css","assets/objective-types.CuiNbA6A.js","assets/gm-tools.BcndmVEn.js","assets/talent-effects.CY-tOZj6.js","assets/decks.CN3iDKhv.js","assets/discovery.I-q7Uafb.js","assets/bestiary.CPB8-5uX.js"])))=>i.map(i=>d[i]);
import{a as I,i as c,l as T}from"./utils.lBShoim5.js";import{D as N,b as k}from"./state.42sFgcOQ.js";import{n as u}from"./Toast.DDAtBIAw.js";import{t as _}from"./preload-helper.BATLnrmA.js";import{n as D,t as j}from"./objective-types.CuiNbA6A.js";import{n as S,o as z,r as O}from"./bestiary.CPB8-5uX.js";var o=null,b=null,g=!1,$=null;function n(t){return c(String(t??"")).replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function C(t,d){try{return JSON.parse(t)}catch{return d}}function L(t){return{beast:"green",undead:"red",humanoid:"blue",fiend:"purple",construct:"gold",plant:"green",dragon:"red",elemental:"blue",celestial:"gold",abomination:"purple"}[(t||"").toLowerCase()]||"gold"}function W(t){E();const d=k();let r=null;if(t){if(r=d.encounters?.find(e=>String(e.id)===String(t)),!r){u("Encounter not found.","error");return}b=t,g=!1}else r={id:I("enc_"),title:"",body:"",difficulty:3,location:"",status:"draft",type:j,adversaries:[],created:Date.now()},b=r.id,g=!0;A(r)}function E(){o&&o.parentNode&&o.parentNode.removeChild(o),o=null,b=null,g=!1,$&&($.forEach(t=>{t.style.display=""}),$=null)}function A(t){o=document.createElement("div"),o.className="editor-screen-host",o.style.cssText="width:100%;padding:1rem 0;";const d=(t.adversaries||[]).map((e,s)=>`
        <div class="adv-row" data-index="${s}" style="display:flex;gap:0.35rem;margin:0.3rem 0;align-items:center;flex-wrap:wrap;">
            <input type="text" class="adv-name" placeholder="Name" value="${n(e.name||"")}" style="flex:2;min-width:120px;" />
            <input type="text" class="adv-body" placeholder="Description / stats" value="${n(e.body||"")}" style="flex:3;min-width:150px;" />
            <input type="hidden" class="adv-tl" value="${e.tl!==void 0?n(String(e.tl)):""}" />
            <input type="hidden" class="adv-class" value="${n(e.class||"")}" />
            <input type="hidden" class="adv-category" value="${n(e.category||"")}" />
            <input type="hidden" class="adv-stats" value="${n(JSON.stringify(e.stats||{}))}" />
            <input type="hidden" class="adv-sb-spends" value="${n(JSON.stringify(e.sb_spends||[]))}" />
            ${e.tl!==void 0?`<span class="badge" style="font-size:0.65rem;background:rgba(255,100,100,0.15);color:var(--red);padding:0.05rem 0.4rem;border-radius:10px;">TL${e.tl}</span>`:""}
            ${e.class?`<span class="badge" style="font-size:0.65rem;background:rgba(100,180,255,0.15);color:var(--accent);padding:0.05rem 0.4rem;border-radius:10px;">Class ${n(e.class)}</span>`:""}
            ${e.category?`<span class="badge badge-${L(e.category)}" style="font-size:0.65rem;color:white;padding:0.05rem 0.4rem;border-radius:10px;">${c(e.category)}</span>`:""}
            <button class="btn btn-xs btn-danger adv-remove" data-index="${s}">✕</button>
        </div>
    `).join("");o.innerHTML=`
        <div class="editor-screen" style="max-width:680px;margin:0 auto;">
            <button id="editor-close" class="btn btn-secondary editor-back">← Back</button>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
                <h2 style="margin:0;color:var(--gold);">${g?"New Encounter":"Edit Encounter"}</h2>
            </div>

            <div class="form-group" style="margin-bottom:0.8rem;">
                <label>Title *</label>
                <input id="enc-title" value="${n(t.title)}" placeholder="Encounter name" style="width:100%;" />
            </div>

            <div class="form-group" style="margin-bottom:0.8rem;">
                <label>Description</label>
                <textarea id="enc-body" rows="3" placeholder="Describe the encounter..." style="width:100%;">${n(t.body||"")}</textarea>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.8rem;margin-bottom:0.8rem;">
                <div class="form-group">
                    <label>Threat Level (1-10)</label>
                    <input type="number" id="enc-difficulty" value="${t.difficulty||3}" min="1" max="10" />
                </div>
                <div class="form-group">
                    <label>Location</label>
                    <input id="enc-location" value="${n(t.location||"")}" placeholder="Where?" />
                </div>
            </div>

            <div class="form-group" style="margin-bottom:0.8rem;">
                <label title="What kind of clock is this? Combat keeps its real Harm/Fatigue/armor math; every other type is a labeled progress/setback track for the appropriate scene — a heist, a lock, a negotiation, etc.">
                    Objective Type
                </label>
                <select id="enc-objective-type">
                    ${Object.entries(D).map(([e,s])=>`
                        <option value="${n(e)}" ${(t.type||"combat")===e?"selected":""}>
                            ${s.icon} ${c(s.label)} — ${c(s.description)}
                        </option>
                    `).join("")}
                </select>
            </div>

            <div id="enc-custom-fields" style="display:${(t.type||"combat")==="custom"?"grid":"none"};grid-template-columns:1fr 1fr;gap:0.8rem;margin-bottom:0.8rem;">
                <div class="form-group">
                    <label>Timer Label</label>
                    <input id="enc-custom-label" value="${n(t.customLabel||"")}" placeholder="e.g. Ritual Completion" style="width:100%;" />
                </div>
                <div class="form-group">
                    <label>Tick Label</label>
                    <input id="enc-custom-tick-label" value="${n(t.customTickLabel||"")}" placeholder="e.g. chant" style="width:100%;" />
                </div>
            </div>

            <div class="form-group" style="margin-bottom:0.8rem;">
                <label>Status</label>
                <select id="enc-status">
                    <option value="draft" ${t.status==="draft"?"selected":""}>Draft</option>
                    <option value="active" ${t.status==="active"?"selected":""}>Active</option>
                    <option value="resolved" ${t.status==="resolved"?"selected":""}>Resolved</option>
                </select>
            </div>

            <div style="margin-bottom:0.8rem;">
                <label style="display:block;margin-bottom:0.3rem;">Adversaries</label>
                <div id="adv-list">${d}</div>
                <div style="display:flex;gap:0.5rem;margin-top:0.4rem;flex-wrap:wrap;">
                    <button class="btn btn-sm" id="adv-add">+ Add Adversary</button>
                    <button class="btn btn-sm btn-ghost" id="adv-import-bestiary">📖 Import from Bestiary</button>
                </div>
            </div>

            <div style="display:flex;gap:0.5rem;margin-top:1rem;border-top:1px solid var(--border);padding-top:1rem;flex-wrap:wrap;">
                <button class="btn btn-gold" id="editor-save">💾 Save</button>
                <button class="btn btn-primary" id="editor-open-tracker">⚔️ Open Combat Tracker</button>
                <button class="btn" id="editor-cancel">Cancel</button>
            </div>
        </div>
    `;const r=document.getElementById("app-content")||document.body;$=Array.from(r.children),$.forEach(e=>{e.style.display="none"}),r.appendChild(o),window.scrollTo({top:0}),o.querySelector("#editor-close")?.addEventListener("click",E),o.querySelector("#editor-cancel")?.addEventListener("click",E),o.querySelector("#editor-save")?.addEventListener("click",()=>B(t)),o.querySelector("#editor-open-tracker")?.addEventListener("click",()=>{if(B(t,!0)){const e=k().encounters.find(s=>String(s.id)===String(b));e&&(z(e.id),E())}}),o.querySelector("#adv-add")?.addEventListener("click",()=>{const e=document.getElementById("adv-list"),s=document.createElement("div");s.className="adv-row",s.style.cssText="display:flex;gap:0.35rem;margin:0.3rem 0;align-items:center;flex-wrap:wrap;",s.innerHTML=`
            <input type="text" class="adv-name" placeholder="Name" style="flex:2;min-width:120px;" />
            <input type="text" class="adv-body" placeholder="Description / stats" style="flex:3;min-width:150px;" />
            <input type="hidden" class="adv-tl" value="" />
            <input type="hidden" class="adv-class" value="" />
            <input type="hidden" class="adv-category" value="" />
            <input type="hidden" class="adv-stats" value="{}" />
            <input type="hidden" class="adv-sb-spends" value="[]" />
            <button class="btn btn-xs btn-danger adv-remove">✕</button>
        `,e.appendChild(s);const p=s.querySelector(".adv-name");p&&setTimeout(()=>p.focus(),50)}),o.querySelector("#adv-import-bestiary")?.addEventListener("click",M),o.querySelector("#enc-objective-type")?.addEventListener("change",q),q(),o.querySelector("#adv-list")?.addEventListener("click",e=>{if(e.target.classList.contains("adv-remove")){const s=e.target.closest(".adv-row");s&&s.remove()}})}function q(){const t=document.getElementById("enc-objective-type")?.value||"combat",d=document.getElementById("enc-custom-fields");d&&(d.style.display=t==="custom"?"grid":"none")}async function M(){const t=await O();if(!t||t.length===0){u("Bestiary not loaded yet.","error");return}const d=o?.querySelector("#bestiary-import-panel");d&&d.remove();const r=document.createElement("div");r.id="bestiary-import-panel",r.style.cssText=`
        background: var(--bg-panel, var(--bg2)); padding: 1rem; border-radius: 10px;
        border: 1px solid var(--border); margin-top: 0.5rem;
    `,r.innerHTML=`
        <h3 style="margin-top:0;">📖 Import from Bestiary</h3>
        <input type="text" id="bestiary-import-search" placeholder="Search creatures..."
               style="width:100%; padding:0.4rem; margin-bottom:0.5rem;">
        <div id="bestiary-import-list" style="max-height:300px; overflow-y:auto;"></div>
        <button id="bestiary-import-close" class="btn btn-sm btn-ghost"
                style="margin-top:0.5rem;">Close</button>
    `,(o?.querySelector("#adv-list")?.parentElement||o).appendChild(r);const e=r.querySelector("#bestiary-import-search"),s=r.querySelector("#bestiary-import-list"),p=r.querySelector("#bestiary-import-close");function f(v=""){const h=v.toLowerCase().trim(),x=t.filter(l=>(l.name||"").toLowerCase().includes(h)||(S(l)||"").toLowerCase().includes(h));if(x.length===0){s.innerHTML='<div style="color:var(--text3);padding:1rem;">No creatures found.</div>';return}s.innerHTML=x.map(l=>`
            <div class="bestiary-import-item" data-name="${n(l.name)}"
                 style="padding:0.5rem; border-bottom:1px solid var(--border); cursor:pointer;
                        display:flex; justify-content:space-between; align-items:center;flex-wrap:wrap;gap:0.4rem;">
                <div style="display:flex;align-items:center;gap:0.4rem;flex-wrap:wrap;">
                    <strong style="font-size:0.9rem;">${c(l.name)}</strong>
                    ${l.tl!==void 0?`<span style="font-size:0.65rem;color:var(--red);">TL${l.tl}</span>`:""}
                    ${l.class?`<span style="font-size:0.65rem;color:var(--accent);">Class ${c(l.class)}</span>`:""}
                    ${l.category?`<span class="badge badge-${L(l.category)}" style="font-size:0.6rem;color:white;">${c(l.category)}</span>`:""}
                </div>
                <span style="font-size:0.75rem;color:var(--text3);max-width:220px;overflow:hidden;text-overflow:ellipsis;">
                    ${c((S(l)||"").slice(0,60))}${(S(l)||"").length>60?"…":""}
                </span>
            </div>
        `).join(""),s.querySelectorAll(".bestiary-import-item").forEach(l=>{l.addEventListener("click",()=>{const y=l.dataset.name,i=t.find(w=>w.name===y);if(!i)return;const a=document.getElementById("adv-list"),m=document.createElement("div");m.className="adv-row",m.style.cssText="display:flex;gap:0.35rem;margin:0.3rem 0;align-items:center;flex-wrap:wrap;",m.innerHTML=`
                    <input type="text" class="adv-name" placeholder="Name" value="${n(i.name)}" style="flex:2;min-width:120px;" />
                    <input type="text" class="adv-body" placeholder="Description / stats" value="${n(S(i))}" style="flex:3;min-width:150px;" />
                    <input type="hidden" class="adv-tl" value="${i.tl!==void 0?n(String(i.tl)):""}" />
                    <input type="hidden" class="adv-class" value="${n(i.class||"")}" />
                    <input type="hidden" class="adv-category" value="${n(i.category||"")}" />
                    <input type="hidden" class="adv-stats" value="${n(JSON.stringify(i.stats||{}))}" />
                    <input type="hidden" class="adv-sb-spends" value="${n(JSON.stringify(i.sb_spends||[]))}" />
                    ${i.tl!==void 0?`<span class="badge" style="font-size:0.65rem;background:rgba(255,100,100,0.15);color:var(--red);padding:0.05rem 0.4rem;border-radius:10px;">TL${i.tl}</span>`:""}
                    ${i.class?`<span class="badge" style="font-size:0.65rem;background:rgba(100,180,255,0.15);color:var(--accent);padding:0.05rem 0.4rem;border-radius:10px;">Class ${c(i.class)}</span>`:""}
                    ${i.category?`<span class="badge badge-${L(i.category)}" style="font-size:0.65rem;color:white;padding:0.05rem 0.4rem;border-radius:10px;">${c(i.category)}</span>`:""}
                    <button class="btn btn-xs btn-danger adv-remove">✕</button>
                `,a.appendChild(m),u(`Added ${i.name} to adversaries.`,"success"),r.remove()})})}e.addEventListener("input",v=>f(v.target.value)),p.addEventListener("click",()=>r.remove()),f(""),e.focus()}function B(t,d=!1){const r=document.getElementById("enc-title")?.value.trim();if(!r){if(!d){u("Title is required.","error");const a=document.getElementById("enc-title");a&&(a.focus(),a.style.borderColor="var(--red)")}return!1}const e=document.getElementById("enc-body")?.value.trim()||"",s=Math.min(Math.max(T(document.getElementById("enc-difficulty")?.value,3),1),10),p=document.getElementById("enc-location")?.value.trim()||"",f=document.getElementById("enc-status")?.value||"draft",v=document.getElementById("enc-objective-type")?.value||"combat",h=document.getElementById("enc-custom-label")?.value.trim()||"",x=document.getElementById("enc-custom-tick-label")?.value.trim()||"",l=[];document.querySelectorAll(".adv-row").forEach(a=>{const m=a.querySelector(".adv-name")?.value.trim();if(m){const w=a.querySelector(".adv-tl")?.value.trim();l.push({name:m,body:a.querySelector(".adv-body")?.value.trim()||"",tl:w?T(w,void 0):void 0,class:a.querySelector(".adv-class")?.value.trim()||"",category:a.querySelector(".adv-category")?.value.trim()||"",stats:C(a.querySelector(".adv-stats")?.value.trim()||"{}",{}),sb_spends:C(a.querySelector(".adv-sb-spends")?.value.trim()||"[]",[])})}});const y=k();y.encounters||(y.encounters=[]);let i=!1;if(g){const a={id:t.id||I("enc_"),title:r,body:e,difficulty:s,location:p,status:f,type:v,customLabel:h,customTickLabel:x,adversaries:l,created:Date.now()};y.encounters.push(a),b=a.id,g=!1,i=!0,d||u(`✅ Encounter "${r}" created.`,"success")}else{const a=y.encounters.find(m=>String(m.id)===String(b));a?(a.title=r,a.body=e,a.difficulty=s,a.location=p,a.status=f,a.type=v,a.customLabel=h,a.customTickLabel=x,a.adversaries=l,i=!0,d||u(`✅ Encounter "${r}" updated.`,"success")):(d||u("Encounter not found.","error"),i=!1)}return i&&(N(),d||(E(),_(()=>import("./encounters.DM8SkZZ1.js").then(a=>{a.renderEncounters&&a.renderEncounters()}),__vite__mapDeps([0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15])))),i}export{W as openEditor};
