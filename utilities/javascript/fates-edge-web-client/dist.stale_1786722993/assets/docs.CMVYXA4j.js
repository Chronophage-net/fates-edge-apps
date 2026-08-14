import{i as p}from"./utils.lBShoim5.js";import{n as m}from"./Toast.DDAtBIAw.js";var f="/data/docs/",G="/data/docs/manifest.json",N="/data/docs/manifest-core.json",w="fates-edge-docs-cache",c={core:{label:"📘 Core",folder:"core",icon:"📘",description:"Core rulebooks and essential documents"},resources:{label:"📚 Resources",folder:"resources",icon:"📚",description:"Reference guides, character sheets, and GM aids"},adventures:{label:"🗡️ Adventures",folder:"adventures",icon:"🗡️",description:"Pre-written adventures and campaigns"},expansions:{label:"📦 Expansions",folder:"expansions",icon:"📦",description:"Expansion content and supplementary rules"},travel:{label:"🗺️ Travel",folder:"travel",icon:"🗺️",description:"World guides, regional information, and travel content"},design:{label:"🎨 Design",folder:"design",icon:"🎨",description:"Game design documents and development notes"},konreh:{label:"♟️ Kon'reh",folder:"konreh",icon:"♟️",description:"Kon'reh strategy game content"},quickstart:{label:"⚡ Quickstart",folder:"quickstart",icon:"⚡",description:"One-page quickstart guides for new players"},anthology:{label:"📖 Anthology",folder:"anthology",icon:"📖",description:"Curated story collections and narrative fiction"},"players-guide":{label:"🎲 Player's Guide",folder:"players-guide",icon:"🎲",description:"The full Player's Guide, chapter by chapter"},"gm-guide":{label:"🎬 GM Guide",folder:"gm-guide",icon:"🎬",description:"The full GM Guide, chapters and appendices"},uploaded:{label:"📤 Uploaded",folder:"uploaded",icon:"📤",description:"User-uploaded documents"},other:{label:"📄 Other",folder:"other",icon:"📄",description:"Miscellaneous documents"}},U={};for(const[e,r]of Object.entries(c))U[r.folder]=e;var B=["core","quickstart","players-guide","gm-guide","resources","adventures","expansions","anthology","travel","design","konreh","uploaded","other"],s=[],b=null,T=null;function q(e){return e.replace(/\.html$/,"").replace(/Fates_-_Edge_-_-/g,"").replace(/_/g," ").replace(/-/g," ").replace(/\b\w/g,r=>r.toUpperCase()).trim()}function J(e){return["Saga","Dreams","Serpent","Blood","Carnival","Adventure","Coil","Lantern"].some(r=>e.includes(r))?"adventures":e.includes("Screen")||e.includes("GM")?"resources":e.includes("Reference")||e.includes("SRD")||e.includes("Essentials")||e.includes("Essential")?"core":"other"}function y(e){if(!e)return null;if(e.fullPath)return e.fullPath;if(e.path&&e.file)return(e.path.endsWith("/")?e.path:e.path+"/")+e.file.replace(/^\/+/,"");if(e.file){const r=e.file.replace(/^\/+|\/+$/g,"");let i=e.folder||"";return e.type&&c[e.type]&&(i=c[e.type].folder),!i||i==="core"?f+r:f+i+"/"+r}return null}function A(e){return e&&e.trim().replace(/^\/+|\/+$/g,"").replace(/\s+/g," ")}function F(e,r){return!e||!r?!1:e.fullPath&&r.fullPath?e.fullPath===r.fullPath:e.file&&r.file?A(e.file)===A(r.file):!1}function O(e){if(!e)return!1;try{const r=new DOMParser().parseFromString(e,"text/html");return[!!r.getElementById("app-content"),!!r.getElementById("toast-container"),!!r.querySelector('script[type="module"][src*="app.js"]')].filter(Boolean).length>=2}catch{return!1}}var Y=["script","iframe","object","embed","link","base","meta","applet","form"],V=["href","src","action","formaction","xlink:href"];function K(e){const r=(e||"").trim().toLowerCase();return!!(r.startsWith("javascript:")||r.startsWith("vbscript:")||r.startsWith("data:")&&!/^data:(image\/|font\/|application\/font)/.test(r))}function M(e){if(!e)return"";let r;try{r=new DOMParser().parseFromString(e,"text/html")}catch{return""}return Y.forEach(i=>{r.querySelectorAll(i).forEach(o=>o.remove())}),r.querySelectorAll("*").forEach(i=>{Array.from(i.attributes).forEach(o=>{const a=o.name.toLowerCase();if(a.startsWith("on")){i.removeAttribute(o.name);return}if(a==="srcdoc"){i.removeAttribute(o.name);return}V.includes(a)&&K(o.value)&&i.removeAttribute(o.name)})}),r.body?r.body.innerHTML:""}function C(e){return c[e]?.label||c.other.label}function D(e){return e||"other"}function ae(e){T=e||document.getElementById("tab-docs"),T&&(document.documentElement.classList.contains("light"),T.innerHTML=`
        <h1 class="page-title">📄 Document Library</h1>
        <p class="page-sub">Browse, upload, and manage your Fate's Edge documents.</p>

        <!-- Toolbar -->
        <div class="docs-toolbar" style="display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center;padding:0.6rem 0.8rem;background:var(--bg3);border-radius:var(--radius);border:1px solid var(--border);margin-bottom:1rem;">
            <button class="btn btn-sm btn-primary" id="doc-upload-btn">📤 Upload Doc</button>
            <button class="btn btn-sm btn-secondary" id="doc-refresh-btn">🔄 Refresh</button>
            <button class="btn btn-sm btn-secondary" id="doc-rebuild-btn">📋 Scan Filesystem</button>
            <span style="flex:1;"></span>
            <span id="docsTotalCount" style="font-size:0.75rem;color:var(--text3);"></span>
        </div>

        <!-- Filter Bar -->
        <div class="docs-filter-bar" style="display:flex;flex-wrap:wrap;gap:0.8rem 1rem;align-items:flex-end;padding:0.6rem 0.8rem;background:var(--bg2);border-radius:var(--radius);border:1px solid var(--border);margin-bottom:1rem;">
            <div class="filter-group" style="display:flex;flex-wrap:wrap;gap:0.4rem;align-items:center;flex:1 1 200px;">
                <label style="margin:0;font-size:0.8rem;font-weight:600;color:var(--text2);white-space:nowrap;">Type</label>
                <select id="docsTypeFilter" style="padding:0.35rem 0.6rem;font-size:0.9rem;background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);flex:0 1 160px;">
                    <option value="">All</option>
                </select>
            </div>
            <div class="filter-group" style="display:flex;flex-wrap:wrap;gap:0.4rem;align-items:center;flex:1 1 200px;">
                <label style="margin:0;font-size:0.8rem;font-weight:600;color:var(--text2);white-space:nowrap;">Search</label>
                <input type="text" id="docsSearchInput" placeholder="Filter by title…" style="padding:0.35rem 0.6rem;font-size:0.9rem;background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);flex:1 1 180px;min-width:120px;" />
            </div>
            <div class="filter-actions" style="display:flex;gap:0.4rem;flex-wrap:wrap;">
                <button class="btn btn-sm" id="docsClearFiltersBtn" style="padding:0.35rem 0.8rem;font-size:0.8rem;">✕ Clear</button>
            </div>
            <span id="docsFilterStats" style="font-size:0.8rem;color:var(--text2);padding:0.2rem 0 0 0.2rem;"></span>
        </div>

        <!-- Document Grid -->
        <div id="doc-list" class="doc-grid" style="display:flex;flex-direction:row;gap:1rem;overflow-x:auto;overflow-y:visible;padding:0.5rem 0.2rem 1rem 0.2rem;flex-wrap:nowrap;align-items:stretch;scrollbar-width:thin;scrollbar-color:var(--bg4) var(--bg2);-webkit-overflow-scrolling:touch;">
            <div class="empty-state" style="color:var(--text2);text-align:center;padding:2rem;font-style:italic;min-width:100%;">📄 Loading documents…</div>
        </div>

        <!-- Document Viewer -->
        <div id="doc-viewer-container" style="display:none;margin-top:1.5rem;border-top:2px solid var(--border);padding-top:1rem;transition:all 0.3s ease;">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.6rem;margin-bottom:0.8rem;">
                <h3 id="doc-viewer-title" style="color:var(--gold);margin:0;font-size:1.2rem;"></h3>
                <div style="display:flex;gap:0.4rem;">
                    <button class="btn btn-sm btn-primary" id="doc-copy-url">🔗 Copy Link</button>
                    <button class="btn btn-sm" id="doc-close-viewer">✕ Close</button>
                </div>
            </div>
            <div id="doc-viewer" class="doc-viewer" style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:1.5rem;min-height:500px;height:70vh;max-height:800px;overflow-y:auto;position:relative;">
                <div class="loading" style="display:flex;align-items:center;justify-content:center;height:100%;min-height:400px;color:var(--text2);font-style:italic;padding:2rem;">Select a document to view.</div>
            </div>
        </div>
    `,I(),X(),Q())}function I(){if(document.getElementById("doc-list")){try{const e=localStorage.getItem(w);if(e){const r=JSON.parse(e);if(r.docs&&r.docs.length>0){console.log(`📄 Using cached doc list (${r.docs.length} items)`),s=r.docs,L(s),v(),E(s.length),S();return}}}catch{}console.log("📄 No cache found, loading manifest.json…"),fetch(G).then(e=>{if(!e.ok)throw new Error("manifest.json not found");return e.json()}).then(e=>{let r=[];if(Array.isArray(e)?r=e.map(i=>{const o=i+".html",a=q(o),t=J(o);return{id:i,title:a,file:o,type:t,folder:c[t]?.folder||"",path:"/data/docs/",category:t,categoryLabel:C(t),core:t==="core",active:!0,fullPath:"/data/docs/"+o}}):e.documents&&Array.isArray(e.documents)&&(r=e.documents.map(i=>{const o=i.category||i.type||"other";return i.type=o,i.folder=c[o]?.folder||"",i.fullPath=i.fullPath||y(i),i})),r.length>0){s=r;try{localStorage.setItem(w,JSON.stringify({docs:s,timestamp:Date.now()}))}catch{}console.log(`📚 Loaded ${s.length} documents from manifest.json`),L(s),v(),E(s.length),S();return}throw new Error("No documents in manifest")}).catch(()=>{console.log("📄 manifest.json not found, falling back to manifest-core.json…"),fetch(N).then(e=>{if(!e.ok)throw new Error("manifest-core.json not found");return e.json()}).then(e=>{const r=(e.documents||[]).map(i=>{const o=i.category||i.section||"other";return i.type=o,i.folder=c[o]?.folder||"",i.fullPath=y(i),i});if(r.length>0){s=r;try{localStorage.setItem(w,JSON.stringify({docs:s,timestamp:Date.now()}))}catch{}console.log(`📚 Loaded ${s.length} documents from manifest-core.json (fallback)`),L(s),v(),E(s.length),S()}else H()}).catch(()=>{console.warn("📄 No manifest found, showing empty state."),H()})})}}function H(){const e=document.getElementById("doc-list");e&&(e.innerHTML=`
        <div class="empty-state" style="color:var(--text2);text-align:center;padding:2rem;font-style:italic;min-width:100%;">
            <div style="font-size:2rem;">📭</div>
            <p>No documents found.</p>
            <p class="text-muted" style="font-size:0.85rem;">Use "Scan Filesystem" to discover HTML documents in /data/docs/ and its subdirectories.</p>
        </div>
    `,s=[],E(0),S())}function P(){try{localStorage.setItem(w,JSON.stringify({docs:s,timestamp:Date.now()}))}catch{}}async function Z(){const e=[],r=s.slice(),i=new Set(r.map(o=>o.file));for(const o of[{id:"srd",title:"Fate's Edge Systems Reference Document",file:"Fates_-_Edge_-_-Systems_-_Reference_-_Document.html",type:"core"},{id:"essentials",title:"Fate's Edge Essentials",file:"Fates_-_Edge_-_-Essentials.html",type:"core"},{id:"essential_gm_screen",title:"Fate's Edge Essential GM Screen",file:"Fates_-_Edge_-_-Game_-_Master_-_Screen.html",type:"resources"}]){const a=f+o.file;try{if((await fetch(a,{method:"HEAD"})).ok&&!r.some(t=>t.file===o.file)){const t=o.type||"core",n={id:o.id,title:o.title,file:o.file,type:t,folder:c[t]?.folder||"",path:f,category:t,categoryLabel:C(t),categoryClass:D(t),core:t==="core",active:!0,adventure:t==="adventures",tier:null,sessions:null,type_label:null};n.fullPath=y(n),e.push(n),console.log(`📄 Discovered: ${o.file} (${t})`)}}catch{}}for(const o of[{id:"blood_silk_saga",title:"Blood and Silk: The Complete Saga",file:"Fates_-_Edge_-_-Bloood-_-and-_-Silk-_-Saga.html"},{id:"carnival_broken_dreams",title:"The Carnival of Broken Dreams",file:"Fates_-_Edge_-_-Canival-_-of-_-Broken-_-Dreams.html"},{id:"serpents_coil",title:"The Serpent's Coil",file:"Fates_-_Edge_-_-The-_-Serpent's-_-Coil.html"}]){const a="/data/docs/adventures/"+o.file;try{if((await fetch(a,{method:"HEAD"})).ok&&!r.some(t=>t.file===o.file)){const t="adventures",n={id:o.id,title:o.title,file:o.file,type:t,folder:c[t]?.folder||"",path:f,category:t,categoryLabel:C(t),categoryClass:D(t),core:!1,active:!0,adventure:!0,tier:null,sessions:null,type_label:null};n.fullPath=y(n),e.push(n),console.log(`📄 Discovered adventure: ${o.file}`)}}catch{}}for(const o of["core","resources","adventures","expansions","travel","design","konreh"])try{const a=await fetch(f+o+"/");if(a.ok){const t=await a.text(),n=/href="([^"]+\.html?)"/gi;let l;for(;(l=n.exec(t))!==null;){let d=l[1];if(d=decodeURIComponent(d).replace(/^\/+/,""),d==="index.html"||d==="manifest.json"||d==="manifest-core.json"||i.has(d)||e.some(h=>h.file===d))continue;const u=U[o]||"other",_=d.replace(".html","").replace(".htm","").replace(/_/g," ").replace(/-/g," ").replace(/\b\w/g,h=>h.toUpperCase()),g={id:"discovered_"+Date.now()+"_"+Math.random().toString(36).substr(2,4),title:_,file:d,type:u,folder:o,path:f+o+"/",category:u,categoryLabel:C(u),categoryClass:D(u),core:u==="core",active:!0,adventure:u==="adventures",tier:null,sessions:null,type_label:null};g.fullPath=y(g),e.push(g),console.log(`📄 Discovered from ${o}/: ${d}`)}}}catch{}try{const o=localStorage.getItem("fates-edge-uploaded-docs");if(o){const a=JSON.parse(o);for(const t of a)t.fullPath||(t.fullPath=y(t)),!s.some(n=>F(n,t))&&!e.some(n=>F(n,t))&&(e.push(t),console.log(`📄 Found uploaded: ${t.title}`))}}catch{}if(e.length>0){s=[...s,...e];const o=new Set;s=s.filter(a=>{const t=a.fullPath||a.file;return o.has(t)?!1:(o.add(t),!0)}),P(),$(),m(`📄 Added ${e.length} documents to library.`,"success"),console.log(`📚 Rebuilt cache: ${s.length} total documents`)}else{if(s.length===0)try{const o=await fetch(N);if(o.ok){const a=(await o.json()).documents||[];if(a.length>0){s=a.map(t=>{const n=t.category||t.section||"other";return t.type=n,t.folder=c[n]?.folder||"",t.fullPath=y(t),t}),P(),$(),m(`📄 Loaded ${s.length} core documents.`,"success"),console.log(`📚 Loaded ${s.length} core documents as fallback.`);return}}}catch{}m("No new documents found.","info")}}function Q(){window._themeObserver&&window._themeObserver.disconnect();const e=new MutationObserver(()=>{document.documentElement.classList.contains("light"),b&&R(b,!0)});e.observe(document.documentElement,{attributes:!0,attributeFilter:["class"]}),window._themeObserver=e}function X(){const e=document.getElementById("docsTypeFilter"),r=document.getElementById("docsSearchInput"),i=document.getElementById("docsClearFiltersBtn"),o=document.getElementById("doc-copy-url"),a=document.getElementById("doc-close-viewer"),t=document.getElementById("doc-refresh-btn"),n=document.getElementById("doc-upload-btn"),l=document.getElementById("doc-rebuild-btn");e&&e.addEventListener("change",v),r&&r.addEventListener("input",v),i&&i.addEventListener("click",function(){e&&(e.value=""),r&&(r.value=""),v(),r&&r.focus()}),o&&o.addEventListener("click",oe),a&&a.addEventListener("click",re),t&&t.addEventListener("click",function(){localStorage.removeItem(w),s=[],I(),m("🔄 Refreshed document list","info")}),n&&n.addEventListener("click",ee),l&&l.addEventListener("click",function(){confirm("Scan the filesystem for HTML documents in /data/docs/ and its subdirectories?")&&Z()})}var k=null;function z(e){e.remove(),k&&(k.forEach(r=>{r.style.display=""}),k=null)}function ee(){const e=document.createElement("div");e.className="editor-screen-host",e.style.cssText=`
        display: flex; align-items: center; justify-content: center;
        padding: 1rem 0; animation: fadeIn 0.2s ease;
    `;const r=document.createElement("div");r.className="editor-screen",r.style.cssText=`
        max-width: 500px;
        width: 90%;
    `,r.innerHTML=`
        <h3 style="color:var(--gold);margin-top:0;">📤 Upload Document</h3>
        <p style="color:var(--text2);font-size:0.85rem;">Upload a PDF or HTML document to add to the library.</p>

        <div style="margin:1rem 0;">
            <label style="display:block;font-size:0.85rem;font-weight:600;margin-bottom:0.3rem;">Document Title</label>
            <input id="upload-title" type="text" placeholder="Document title" style="width:100%;padding:0.4rem;background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);" />
        </div>

        <div style="margin:1rem 0;">
            <label style="display:block;font-size:0.85rem;font-weight:600;margin-bottom:0.3rem;">Document Type</label>
            <select id="upload-type" style="width:100%;padding:0.4rem;background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);">
                ${Object.entries(c).map(([a,t])=>`<option value="${a}" ${a==="adventures"?"selected":""}>${t.label}</option>`).join("")}
            </select>
            <div style="font-size:0.65rem;color:var(--text3);margin-top:0.15rem;" id="upload-type-help">Documents are organized into subdirectories by type.</div>
        </div>

        <div style="margin:1rem 0;">
            <label style="display:block;font-size:0.85rem;font-weight:600;margin-bottom:0.3rem;">File (PDF or HTML)</label>
            <input id="upload-file" type="file" accept=".html,.htm,.pdf" style="width:100%;padding:0.4rem;background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);" />
            <div style="font-size:0.7rem;color:var(--text3);margin-top:0.2rem;">Accepted formats: .html, .htm, .pdf</div>
        </div>

        <div style="display:flex;gap:0.5rem;margin-top:1rem;">
            <button id="upload-confirm-btn" class="btn btn-primary">📤 Upload</button>
            <button id="upload-cancel-btn" class="btn btn-secondary">Cancel</button>
        </div>
    `,e.appendChild(r);const i=document.getElementById("app-content")||document.body;if(k=Array.from(i.children),k.forEach(a=>{a.style.display="none"}),i.appendChild(e),window.scrollTo({top:0}),!document.getElementById("upload-modal-styles")){const a=document.createElement("style");a.id="upload-modal-styles",a.textContent=`
            @keyframes fadeIn {
                from { opacity: 0; transform: scale(0.95); }
                to { opacity: 1; transform: scale(1); }
            }
        `,document.head.appendChild(a)}const o=r.querySelector("#upload-type");o&&o.addEventListener("change",function(){const a=document.getElementById("upload-type-help");a&&c[this.value]&&(a.textContent=c[this.value].description)}),r.querySelector("#upload-cancel-btn").addEventListener("click",()=>z(e)),r.querySelector("#upload-confirm-btn").addEventListener("click",async()=>{const a=document.getElementById("upload-title").value.trim(),t=document.getElementById("upload-type").value,n=document.getElementById("upload-file");if(!a){m("Please enter a title.","error");return}if(!n.files||n.files.length===0){m("Please select a file.","error");return}const l=n.files[0],d=l.name.split(".").pop().toLowerCase();if(!["html","htm","pdf"].includes(d)){m("Only HTML and PDF files are accepted.","error");return}try{let u=null;(d==="html"||d==="htm")&&(u=await l.text());const _=a.toLowerCase().replace(/[^a-z0-9]/g,"_").replace(/_+/g,"_").substring(0,50)+"."+d,g=c[t]||c.other,h=g.folder||"",x={id:"uploaded_"+Date.now(),title:a,file:_,type:t,folder:h,path:f+(h?h+"/":""),category:t,categoryLabel:g.label,categoryClass:D(t),core:t==="core",active:!0,uploaded:!0,uploadedAt:new Date().toISOString(),adventure:t==="adventures",tier:null,sessions:null,type_label:null,_content:u};if(x.fullPath=y(x),d==="pdf"&&(x.isPDF=!0),s.some(W=>F(W,x))){m("A document with this file already exists.","warning"),z(e);return}s.push(x),te(x),P(),$(),z(e),m(`📤 Uploaded "${a}" to ${g.label}`,"success")}catch(u){m("Upload failed: "+u.message,"error")}})}function te(e){try{let r=JSON.parse(localStorage.getItem("fates-edge-uploaded-docs")||"[]");r=r.filter(i=>i.file!==e.file),r.push(e),localStorage.setItem("fates-edge-uploaded-docs",JSON.stringify(r))}catch{}}function v(){const e=document.getElementById("docsTypeFilter"),r=document.getElementById("docsSearchInput"),i=document.getElementById("doc-list");if(!i)return;const o=e?e.value:"",a=r?r.value.toLowerCase().trim():"";let t=s;if(o&&(t=t.filter(n=>n.type===o)),a&&(t=t.filter(n=>n.title.toLowerCase().includes(a)||n.file.toLowerCase().includes(a)||n.author&&n.author.toLowerCase().includes(a))),E(t.length),t.length===0){i.innerHTML=`
            <div class="empty-state" style="color:var(--text2);text-align:center;padding:2rem;font-style:italic;min-width:100%;">
                <div style="font-size:1.4rem;">🔍</div>
                <p>No documents match your filters.</p>
                <p class="text-muted" style="font-size:0.85rem;">Try adjusting the type or search term.</p>
            </div>
        `;return}i.innerHTML=t.map(n=>{const l=n.isPDF||n.file?.toLowerCase().endsWith(".pdf")?"📄":"📜",d=c[n.type]||c.other,u=d.icon||"📄",_=d.label||"Other",g=n.tier?`<span style="font-size:0.55rem;padding:0.05rem 0.3rem;border-radius:6px;background:var(--gold)33;color:var(--gold);border:1px solid var(--gold);">Tier ${n.tier}</span>`:"",h=n.sessions?`<span style="font-size:0.55rem;padding:0.05rem 0.3rem;border-radius:6px;background:var(--blue)33;color:var(--blue);border:1px solid var(--blue);">${n.sessions} sessions</span>`:"";return`
            <div class="doc-card" data-fullpath="${p(n.fullPath||"#")}" 
                 style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius);padding:0.8rem;cursor:pointer;transition:all 0.15s;min-width:160px;max-width:200px;flex:0 0 auto;display:flex;flex-direction:column;justify-content:space-between;">
                <div>
                    <div style="font-size:1.5rem;margin-bottom:0.2rem;">${l}</div>
                    <h4 style="color:var(--gold);margin-bottom:0.3rem;font-size:0.95rem;font-weight:600;word-break:break-word;">${p(n.title)}</h4>
                </div>
                <div>
                    <div class="doc-meta" style="font-size:0.75rem;color:var(--text2);display:flex;flex-wrap:wrap;gap:0.3rem;align-items:center;margin-top:0.3rem;">
                        <span class="doc-category-badge ${n.type||"other"}" 
                              style="display:inline-block;padding:0.05rem 0.5rem;border-radius:12px;font-size:0.6rem;font-weight:600;background:var(--bg4);color:var(--text2);letter-spacing:0.02em;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;">
                            ${u} ${p(_)}
                        </span>
                        ${n.core?'<span style="font-size:0.6rem;color:var(--gold);font-weight:600;">⭐ Core</span>':""}
                        ${n.uploaded?'<span style="font-size:0.6rem;color:var(--green);font-weight:600;">📤</span>':""}
                        ${g}
                        ${h}
                    </div>
                    ${n.description?`<div style="font-size:0.65rem;color:var(--text3);margin-top:0.2rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${p(n.description)}</div>`:""}
                </div>
            </div>
        `}).join(""),i.querySelectorAll(".doc-card").forEach(n=>{n.addEventListener("click",function(){const l=this.dataset.fullpath;l&&l!=="#"?R(l):m("Invalid document path.","error")}),n.addEventListener("mouseenter",function(){this.style.borderColor="var(--gold)",this.style.transform="translateY(-2px)"}),n.addEventListener("mouseleave",function(){this.style.borderColor="var(--border)",this.style.transform="translateY(0)"})})}function L(e){const r=document.getElementById("docsTypeFilter");if(!r)return;const i=new Set;e.forEach(t=>{t.type&&i.add(t.type)});const o=r.value;r.innerHTML='<option value="">All Types</option>';const a=Array.from(i).sort((t,n)=>{const l=B.indexOf(t),d=B.indexOf(n);return l===-1&&d===-1?t.localeCompare(n):l===-1?1:d===-1?-1:l-d});a.forEach(t=>{const n=c[t]||c.other,l=document.createElement("option");l.value=t,l.textContent=n.label||t,r.appendChild(l)}),o&&a.includes(o)&&(r.value=o)}function E(e){const r=document.getElementById("docsFilterStats");if(r){const i=s.length;r.textContent=e===i?`${i} documents`:`${e} of ${i} documents`}}function S(){const e=document.getElementById("docsTotalCount");e&&(e.textContent=`${s.length} documents`)}function R(e,r=!1){b=e;const i=document.getElementById("doc-viewer-container"),o=document.getElementById("doc-viewer"),a=document.getElementById("doc-viewer-title");if(!i||!o||!a)return;i.style.display="block",a.textContent="Loading…",o.innerHTML='<div class="loading" style="display:flex;align-items:center;justify-content:center;height:100%;min-height:400px;color:var(--text2);font-style:italic;padding:2rem;">Loading document…</div>';let t=s.find(l=>l.fullPath===e||l.file===e);if(!t){const l=e.split("/").pop();t=s.find(d=>d.file===l),t||(t=s.find(d=>d.fullPath&&d.fullPath.endsWith(e)))}if(t&&t.isPDF){let l=t.fullPath||e;l&&!l.startsWith("http")&&!l.startsWith("/")&&(l="/"+l.replace(/^\.?\/+/,"")),o.innerHTML=`
            <div style="display:flex;flex-direction:column;height:100%;min-height:500px;">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;padding:0.5rem 0;border-bottom:1px solid var(--border);margin-bottom:0.5rem;">
                    <div style="display:flex;gap:0.5rem;align-items:center;">
                        <span style="font-size:1.2rem;">📄</span>
                        <span style="font-weight:600;font-size:1rem;">${p(t.title)}</span>
                        <span class="badge badge-blue">PDF</span>
                    </div>
                    <div style="display:flex;gap:0.3rem;">
                        <button class="btn btn-sm btn-primary" onclick="window.open('${p(l)}', '_blank')">📤 Open in New Tab</button>
                        <button class="btn btn-sm btn-secondary" onclick="window.location.href='${p(l)}'">💾 Download</button>
                    </div>
                </div>
                <div style="flex:1;min-height:450px;background:var(--bg3);border-radius:var(--radius);overflow:hidden;">
                    <iframe
                        src="${p(l)}"
                        style="width:100%;height:100%;min-height:450px;border:none;background:var(--bg3);"
                        allow="fullscreen"
                        sandbox="allow-same-origin"
                        loading="lazy"
                    ></iframe>
                    <!-- Sandbox note: only allow-same-origin is granted, so the
                         browser's built-in PDF viewer can actually fetch/render
                         a same-origin file. allow-scripts is deliberately
                         omitted -- the PDF viewer doesn't need script execution
                         to render, and allow-same-origin + allow-scripts
                         together is the combination that lets sandboxed
                         content script its way back out of the sandbox. -->
                </div>
                <div style="font-size:0.65rem;color:var(--text3);padding:0.3rem 0;text-align:center;">
                    If the PDF does not display, your browser may not support embedded PDF viewing. 
                    Use the "Open in New Tab" button above.
                </div>
            </div>
        `,a.textContent=t.title+" (PDF)";return}if(t&&t._content){const l=M(t._content);if(O(l)){o.innerHTML=`
                <div class="empty-state" style="color:var(--text2);text-align:center;padding:2rem;min-width:100%;">
                    <div style="font-size:2rem;">🚫</div>
                    <p>Could not load document.</p>
                    <p class="text-muted" style="font-size:0.85rem;">The cached content appears to be the application page, not a document.</p>
                    <p class="text-muted" style="font-size:0.75rem;">Document: ${p(t.title)}</p>
                    <button class="btn btn-sm btn-primary" onclick="window.location.reload()" style="margin-top:0.5rem;">🔄 Reload</button>
                </div>
            `,a.textContent="Error",m("Cached content is invalid – please refresh.","error");return}o.innerHTML=j(l,e),a.textContent=t.title,m(`📄 Loaded: ${a.textContent}`,"success");return}let n=t?t.fullPath:e;if(n&&!n.startsWith("http")&&!n.startsWith("/")&&(n="/"+n.replace(/^\.?\/+/,"")),n&&(n=n.replace(/\/+/g,"/").replace(/\s/g,"")),!n||n==="/"||n===f)if(t&&t.file){const l=t.folder?t.folder+"/":"";n=f+l+t.file.replace(/^\/+/,"")}else{m("Could not determine document path.","error");return}console.log(`📄 Loading: ${n}`),fetch(n).then(l=>{if(!l.ok)throw new Error(`HTTP ${l.status}`);return l.text()}).then(l=>{if(O(l)){o.innerHTML=`
                    <div class="empty-state" style="color:var(--text2);text-align:center;padding:2rem;min-width:100%;">
                        <div style="font-size:2rem;">🚫</div>
                        <p>Could not load document.</p>
                        <p class="text-muted" style="font-size:0.85rem;">The server returned the application page instead of the document.</p>
                        <p class="text-muted" style="font-size:0.75rem;">Path: ${p(n)}</p>
                        <p class="text-muted" style="font-size:0.75rem;">Make sure the file exists in /data/docs/ and is accessible.</p>
                        <button class="btn btn-sm btn-primary" onclick="window.location.reload()" style="margin-top:0.5rem;">🔄 Reload</button>
                    </div>
                `,a.textContent="Error",m("Failed to load document – server returned SPA.","error");return}const d=j(M(l),n);if(o.innerHTML=d,t)a.textContent=t.title;else{const u=n.split("/").pop().replace(".html","").replace(/_/g," ");a.textContent=u}m(`📄 Loaded: ${a.textContent}`,"success")}).catch(l=>{console.error("Document load error:",l),o.innerHTML=`
                <div class="empty-state" style="color:var(--text2);text-align:center;padding:2rem;min-width:100%;">
                    <div style="font-size:2rem;">❌</div>
                    <p>Could not load document.</p>
                    <p class="text-muted" style="font-size:0.85rem;">${l.message}</p>
                    <p class="text-muted" style="font-size:0.75rem;">Path: ${p(n)}</p>
                    <button class="btn btn-sm btn-primary" onclick="location.reload()" style="margin-top:0.5rem;">🔄 Reload</button>
                </div>
            `,a.textContent="Error",m(`Failed to load document: ${l.message}`,"error")})}function j(e,r){const i=document.documentElement.classList.contains("light");return`
        <div class="integrated-document ${i?"light":"dark"}" style="
            font-family: var(--font, 'Georgia', serif);
            line-height: 1.7;
            color: var(--text, #222);
            background: var(--bg, #fafaf6);
            padding: 0.5rem;
            max-width: 100%;
        ">
            <style>
                .integrated-document {
                    --bg: ${i?"#fafafa":"#0d0b0f"};
                    --bg2: ${i?"#eaeaea":"#18141c"};
                    --bg3: ${i?"#dfdfdf":"#231e29"};
                    --bg4: ${i?"#d3d3d3":"#2f2838"};
                    --text: ${i?"#212121":"#e6dce8"};
                    --text2: ${i?"#555555":"#b8aabf"};
                    --gold: ${i?"#b8860b":"#d4af37"};
                    --border: ${i?"#bbbbbb":"#3a3242"};
                    --accent: ${i?"#8b5e3c":"#c99a6b"};
                }
                .integrated-document h1 { font-size: 2.2rem; margin-top: 0; border-bottom: 2px solid var(--border); padding-bottom: 0.3rem; color: var(--text); }
                .integrated-document h2 { font-size: 1.8rem; margin-top: 1.5rem; border-bottom: 1px solid var(--border); padding-bottom: 0.2rem; color: var(--text); }
                .integrated-document h3 { font-size: 1.4rem; margin-top: 1.2rem; color: var(--text); }
                .integrated-document h4 { font-size: 1.2rem; margin-top: 1rem; color: var(--text); }
                .integrated-document p { margin: 0.8rem 0; color: var(--text); }
                .integrated-document ul, .integrated-document ol { margin: 0.8rem 0 0.8rem 1.5rem; color: var(--text); }
                .integrated-document li { margin: 0.3rem 0; }
                .integrated-document blockquote { margin: 1rem 0; padding: 0.5rem 1.5rem; border-left: 4px solid var(--gold); background: var(--bg3); color: var(--text2); }
                .integrated-document table { border-collapse: collapse; width: 100%; margin: 1rem 0; font-size: 0.95rem; }
                .integrated-document th, .integrated-document td { border: 1px solid var(--border); padding: 0.5rem 0.8rem; text-align: left; color: var(--text); }
                .integrated-document th { background: var(--bg3); color: var(--gold); }
                .integrated-document code { background: var(--bg3); padding: 0.2rem 0.4rem; border-radius: 4px; font-size: 0.9rem; color: var(--text); }
                .integrated-document pre { background: var(--bg3); padding: 1rem; border-radius: 6px; overflow-x: auto; font-size: 0.9rem; color: var(--text); }
                .integrated-document img { max-width: 100%; height: auto; }
                .integrated-document a { color: var(--gold); text-decoration: none; }
                .integrated-document a:hover { text-decoration: underline; }
                @media (max-width: 768px) {
                    .integrated-document h1 { font-size: 1.8rem; }
                    .integrated-document h2 { font-size: 1.5rem; }
                    .integrated-document h3 { font-size: 1.2rem; }
                }
            </style>
            <div class="document-content">${e}</div>
        </div>
    `}function re(){const e=document.getElementById("doc-viewer-container"),r=document.getElementById("doc-viewer");e&&(e.style.display="none"),r&&(r.innerHTML='<div class="loading" style="display:flex;align-items:center;justify-content:center;height:100%;min-height:400px;color:var(--text2);font-style:italic;padding:2rem;">Select a document to view.</div>'),b=null}function oe(){if(!b){m("No document loaded.","error");return}let e=b;e&&!e.startsWith("http")&&(e.startsWith("/")||(e="/"+e.replace(/^\.?\/+/,"")),e=window.location.origin+e),navigator.clipboard.writeText(e).then(()=>m("Document URL copied!","success")).catch(()=>{prompt("Copy this URL:",e)})}function $(){document.getElementById("doc-list")&&(L(s),v(),E(s.length),S())}function le(){console.log("[Docs] Activated"),s.length===0?I():$()}function se(){console.log("[Docs] Deactivated")}function de(){localStorage.removeItem(w),s=[],I()}function ce(){window._themeObserver&&(window._themeObserver.disconnect(),window._themeObserver=null),s=[],b=null,T=null}export{v as applyDocsFilter,re as closeDocViewer,oe as copyDocUrl,ce as destroy,I as loadDocs,R as loadDocument,le as onActivate,se as onDeactivate,de as refresh,ae as render,Z as scanFilesystem};
