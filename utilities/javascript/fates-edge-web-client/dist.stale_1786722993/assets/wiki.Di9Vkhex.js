const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/editor.a-X7bmKq.js","assets/utils.lBShoim5.js","assets/state.42sFgcOQ.js","assets/rolldown-runtime.BQ-_32WO.js","assets/Toast.DDAtBIAw.js","assets/preload-helper.BATLnrmA.js"])))=>i.map(i=>d[i]);
import{i as r,r as L}from"./utils.lBShoim5.js";import{D as k,b as u}from"./state.42sFgcOQ.js";import{n as d}from"./Toast.DDAtBIAw.js";import{t as C}from"./preload-helper.BATLnrmA.js";var R="./data/wiki.json",f=null,p=[];function x(o){f=o,f.innerHTML=`
        <div class="wiki-modern-layout">
            <header class="wiki-header">
                <h1 class="wiki-title">📖 Wiki</h1>
                <p class="wiki-subtitle">Reference rules, patrons, regions, equipment, talents, assets, and more. Markdown supported.</p>
            </header>

            <div class="wiki-grid">
                <!-- Sidebar -->
                <aside class="wiki-sidebar">
                    <div class="wiki-sidebar-section">
                        <h3>📂 Categories</h3>
                        <ul class="wiki-category-list" id="wiki-category-list"></ul>
                    </div>
                    <div class="wiki-sidebar-section">
                        <h3>🏷️ Tags</h3>
                        <div class="wiki-tag-cloud" id="wiki-tag-cloud"></div>
                    </div>
                    <div class="wiki-sidebar-section">
                        <h3>ℹ️ Stats</h3>
                        <div id="wiki-stats-sidebar">
                            <div>Total: <span id="wiki-total-count">0</span></div>
                            <div>Local: <span id="wiki-local-count">0</span></div>
                            <div>Bundled: <span id="wiki-remote-count">0</span></div>
                            <div>Hidden: <span id="wiki-hidden-count">0</span></div>
                        </div>
                    </div>
                    <div class="wiki-sidebar-section">
                        <button class="btn btn-primary btn-sm" id="wiki-add-btn" style="width:100%;">+ Add Entry</button>
                        <button class="btn btn-sm btn-secondary" id="wiki-reload-btn" style="width:100%;margin-top:0.3rem;">🔄 Reload Bundled</button>
                        <button class="btn btn-sm btn-ghost" id="wiki-import-btn" style="width:100%;margin-top:0.3rem;">📥 Import All</button>
                    </div>
                </aside>

                <!-- Main Content -->
                <main class="wiki-content">
                    <div class="wiki-toolbar">
                        <div class="wiki-search-wrap">
                            <input type="text" id="wiki-search" placeholder="🔍 Search wiki…" class="wiki-search-input" />
                        </div>
                        <div class="wiki-filter-wrap">
                            <select id="wiki-cat-filter" class="wiki-filter-select">
                                <option value="">All Categories</option>
                                <option value="rules">📜 Rules</option>
                                <option value="patrons">👁️ Patrons</option>
                                <option value="regions">🌍 Regions</option>
                                <option value="magic">🔮 Magic</option>
                                <option value="combat">⚔️ Combat</option>
                                <option value="lore">📚 Lore</option>
                                <option value="talents">🧠 Talents</option>
                                <option value="assets">🏛️ Assets</option>
                                <option value="equipment">⚒️ Equipment</option>
                                <option value="characters">👤 Characters</option>
                                <option value="monsters">🐉 Monsters</option>
                            </select>
                        </div>
                        <div id="wiki-status" class="wiki-status"></div>
                    </div>

                    <div id="wiki-list-container">
                        <div id="wiki-list"></div>
                    </div>
                </main>
            </div>
        </div>
    `,a(),S(),b()}function b(){const o=document.getElementById("wiki-status");return o&&(o.textContent="📥 Loading bundled wiki…"),fetch(R).then(e=>{if(!e.ok)throw new Error(`HTTP ${e.status} – ${e.statusText}`);return e.json()}).then(e=>{let t=[];if(Array.isArray(e))t=e;else if(e&&typeof e=="object"){for(const n of["entries","items","data","wiki","docs"])if(Array.isArray(e[n])){t=e[n];break}t.length===0&&console.warn("Wiki data is an object but no array property found. Using empty array.")}if(!Array.isArray(t)||t.length===0)throw new Error('wiki.json must contain an array (or an object with an "entries" array).');const s=u();s.wikiEntries||(s.wikiEntries=[]),s.hiddenRemoteIds||(s.hiddenRemoteIds=[]),s.wikiEntries=s.wikiEntries.filter(n=>n.source!=="remote");let i=0;return t.forEach((n,l)=>{if(!n||!n.title)return;const w="remote-"+(n.id||l);s.hiddenRemoteIds.includes(w)||s.wikiEntries.find(c=>c.title.toLowerCase().trim()===n.title.toLowerCase().trim())||(s.wikiEntries.push({id:w,title:n.title,category:n.category||"lore",body:n.body||"",tags:Array.isArray(n.tags)?n.tags:n.tags?String(n.tags).split(",").map(c=>c.trim()).filter(Boolean):[],cost:n.cost!=null?Number(n.cost):null,slot:n.slot||"",source:"remote"}),i++)}),k(),o&&(o.textContent=`✅ Loaded ${i} bundled entries.`),a(),i>0&&d(`📥 Loaded ${i} bundled wiki entries.`,"success"),{added:i,total:t.length}}).catch(e=>{console.warn("Remote wiki load failed:",e);const t=document.getElementById("wiki-status");return t&&(t.textContent=`⚠️ Could not load bundled wiki (${e.message}). Using local entries only.`),a(),{added:0,total:0,error:e}})}function a(){const o=j(),e=document.getElementById("wiki-list");if(e){if(_(),T(o),o.length===0){e.innerHTML=`
            <div class="wiki-empty-state">
                <div style="font-size:3rem;margin-bottom:0.5rem;">📖</div>
                <div>No matching entries.</div>
                <div style="font-size:0.9rem;color:var(--text3);">Try adjusting your search or filter.</div>
            </div>
        `;return}e.innerHTML=o.map(t=>{const s=t.source==="remote";if(s&&(window._hiddenRemoteIds||[]).includes(String(t.id)))return"";const i=s?'<span class="badge badge-remote">📦 Bundled</span>':'<span class="badge badge-local">📝 Local</span>',n=t.cost!=null?`<span class="badge badge-cost">${t.cost} XP</span>`:"",l=(t.tags||[]).slice(0,4).map(I=>`<span class="badge badge-tag">#${r(I)}</span>`).join(""),w=(t.tags||[]).length>4?`<span class="badge badge-more">+${(t.tags||[]).length-4}</span>`:"";let c="";s?y(t)?c='<span class="badge badge-cloned" style="color:var(--green);">✅ Cloned</span>':c=`
                    <button class="btn btn-xs btn-primary wiki-clone-btn" data-id="${r(String(t.id))}">📋 Clone</button>
                    <button class="btn btn-xs btn-ghost wiki-hide-btn" data-id="${r(String(t.id))}" title="Hide this entry">✕</button>
                `:c=`
                <button class="btn btn-xs btn-primary wiki-edit-btn" data-id="${r(String(t.id))}">✏️ Edit</button>
                <button class="btn btn-xs btn-danger wiki-delete-btn" data-id="${r(String(t.id))}">🗑️</button>
            `;const B=t.body?`<div class="wiki-entry-preview">${r(t.body.slice(0,300))}${t.body.length>300?"…":""}</div>`:"";return`
            <div class="wiki-entry-card" data-id="${r(String(t.id))}">
                <div class="wiki-entry-header">
                    <h3 class="wiki-entry-title" onclick="window.toggleWikiBody('${r(String(t.id))}')">
                        ${r(t.title)}
                    </h3>
                    <div class="wiki-entry-meta">
                        <span class="wiki-entry-category">${r(t.category||"uncategorized")}</span>
                        ${i}
                        ${n}
                    </div>
                </div>
                <div class="wiki-entry-tags">
                    ${l}
                    ${w}
                </div>
                <div class="wiki-entry-summary" id="wiki-body-${r(String(t.id))}">
                    ${B}
                    ${t.body&&t.body.length>300?`<div class="wiki-entry-full" style="display:none;">${E(t.body)}</div>`:E(t.body)}
                </div>
                <div class="wiki-entry-actions">
                    ${c}
                    ${t.body&&t.body.length>300?`<button class="btn btn-xs btn-ghost wiki-expand-btn" data-id="${r(String(t.id))}">▼ Expand</button>`:""}
                </div>
            </div>
        `}).join(""),A()}}function A(){const o=document.getElementById("wiki-list");if(!o)return;o._wikiListener&&o.removeEventListener("click",o._wikiListener);const e=t=>{const s=t.target.closest("[data-action]");if(!s)return;const i=s.dataset.action,n=s.dataset.id;switch(i){case"edit":g(n);break;case"clone":H(n);break;case"delete":M(n);break;case"hide":$(n);break;case"expand":v(n)}};o.addEventListener("click",e),o._wikiListener=e}function T(o){const e=document.getElementById("wiki-category-list");if(e){const s={};o.forEach(i=>{const n=i.category||"uncategorized";s[n]=(s[n]||0)+1}),e.innerHTML=Object.entries(s).sort((i,n)=>n[1]-i[1]).map(([i,n])=>`<li><a href="#" class="wiki-category-link" data-cat="${r(i)}">${r(i)} <span class="count">(${n})</span></a></li>`).join(""),e.querySelectorAll(".wiki-category-link").forEach(i=>{i.addEventListener("click",n=>{n.preventDefault();const l=i.dataset.cat,w=document.getElementById("wiki-cat-filter");w&&(w.value=l,a())})})}const t=document.getElementById("wiki-tag-cloud");if(t){const s={};o.forEach(i=>{(i.tags||[]).forEach(n=>{s[n]=(s[n]||0)+1})}),t.innerHTML=Object.entries(s).sort((i,n)=>n[1]-i[1]).slice(0,20).map(([i,n])=>`<span class="wiki-tag" data-tag="${r(i)}">#${r(i)} <span class="count">(${n})</span></span>`).join(" "),t.querySelectorAll(".wiki-tag").forEach(i=>{i.addEventListener("click",()=>{const n=document.getElementById("wiki-search");n&&(n.value=i.dataset.tag,a())})})}}function _(){const o=u(),e=o.wikiEntries||[],t=o.hiddenRemoteIds||[],s=e.length,i=e.filter(l=>l.source!=="remote").length,n=e.filter(l=>l.source==="remote").length;document.getElementById("wiki-total-count").textContent=s,document.getElementById("wiki-local-count").textContent=i,document.getElementById("wiki-remote-count").textContent=n,document.getElementById("wiki-hidden-count").textContent=t.length}function j(){const o=u(),e=document.getElementById("wiki-search")?.value?.toLowerCase()||"",t=document.getElementById("wiki-cat-filter")?.value||"";let s=o.wikiEntries||[];return e&&(s=s.filter(i=>(i.title||"").toLowerCase().includes(e)||(i.body||"").toLowerCase().includes(e)||(i.tags||[]).some(n=>n.toLowerCase().includes(e)))),t&&(s=s.filter(i=>i.category===t)),s.sort((i,n)=>i.source==="remote"&&n.source!=="remote"?1:i.source!=="remote"&&n.source==="remote"?-1:(i.title||"").localeCompare(n.title||"")),s}function E(o){if(!o)return"";try{if(window.marked){if(typeof window.marked.parse=="function")return window.marked.parse(o);if(typeof window.marked=="function")return window.marked(o)}return r(o).replace(/\n/g,"<br>")}catch{return r(o)}}function y(o){return(u().wikiEntries||[]).some(e=>e.source!=="remote"&&e.title.toLowerCase().trim()===o.title.toLowerCase().trim())}function H(o){const e=u(),t=(e.wikiEntries||[]).find(i=>String(i.id)===String(o)&&i.source==="remote");if(!t){d("Bundled entry not found.","error");return}if(y(t)){d(`"${t.title}" already cloned.`,"warning");return}const s={...t,id:"local-"+Date.now()+"-"+Math.random().toString(36).substr(2,4),source:"local",title:t.title};e.wikiEntries||(e.wikiEntries=[]),e.wikiEntries.push(s),k(),a(),d(`📋 Cloned "${t.title}" from bundled wiki.`,"success"),setTimeout(()=>g(s.id),300)}function $(o){const e=u(),t=e.wikiEntries||[],s=t.find(i=>String(i.id)===String(o));s&&(e.hiddenRemoteIds||(e.hiddenRemoteIds=[]),e.hiddenRemoteIds.push(String(o)),e.wikiEntries=t.filter(i=>String(i.id)!==String(o)),k(),a(),d(`🚫 Hidden "${s.title}" from view.`,"info"))}function M(o){const e=u(),t=e.wikiEntries||[],s=t.find(i=>String(i.id)===String(o));if(s)if(s.source==="remote"){if(!confirm(`Hide bundled entry "${s.title}"?`))return;$(o)}else{if(!confirm(`Delete wiki entry "${s.title}"?`))return;e.wikiEntries=t.filter(i=>String(i.id)!==String(o)),k(),a(),d(`🗑️ Deleted "${s.title}".`,"success")}}function W(){const o=u(),e=(o.wikiEntries||[]).filter(i=>i.source==="remote");if(e.length===0){d("No bundled entries to import.","warning");return}const t=e.filter(i=>!y(i));if(t.length===0){d("All bundled entries already cloned.","info");return}if(!confirm(`Import all ${t.length} bundled entries?`))return;let s=0;t.forEach(i=>{const n={...i,id:"local-"+Date.now()+"-"+Math.random().toString(36).substr(2,4),source:"local",title:i.title};o.wikiEntries.push(n),s++}),k(),a(),d(`📥 Imported ${s} bundled entries.`,"success")}function v(o){const e=document.querySelector(`.wiki-entry-card[data-id="${o}"]`);if(!e)return;const t=e.querySelector(".wiki-entry-full"),s=e.querySelector(".wiki-entry-preview"),i=e.querySelector(".wiki-expand-btn");if(t){const n=t.style.display==="none";t.style.display=n?"block":"none",s&&(s.style.display=n?"none":"block"),i&&(i.textContent=n?"▲ Collapse":"▼ Expand")}}window.toggleWikiBody=v;function g(o){C(()=>import("./editor.a-X7bmKq.js").then(e=>{e.openEditor?e.openEditor(o):d("Editor module not available.","error")}),__vite__mapDeps([0,1,2,3,4,5])).catch(e=>{console.error("Failed to load editor:",e),d("Failed to load editor. Please check console.","error")})}function m(o,e,t){o&&(o.addEventListener(e,t),p.push({el:o,event:e,handler:t}))}function S(){h();const o=document.getElementById("wiki-search"),e=document.getElementById("wiki-cat-filter"),t=document.getElementById("wiki-add-btn"),s=document.getElementById("wiki-reload-btn"),i=document.getElementById("wiki-import-btn");o&&m(o,"input",L(a,200)),e&&m(e,"change",a),t&&m(t,"click",()=>g(null)),s&&m(s,"click",()=>{b().then(()=>a())}),i&&m(i,"click",W)}function h(){p.forEach(({el:o,event:e,handler:t})=>{o.removeEventListener(e,t)}),p=[]}function q(){a()}function D(){h(),f=null}var N={render:x,destroy:D,refresh:q,loadRemoteWiki:b,renderWiki:a,toggleWikiBody:v,openWikiEditor:g,attachEvents:S,detachEvents:h};export{S as attachEvents,N as default,D as destroy,h as detachEvents,b as loadRemoteWiki,g as openWikiEditor,q as refresh,x as render,a as renderWiki,v as toggleWikiBody};
