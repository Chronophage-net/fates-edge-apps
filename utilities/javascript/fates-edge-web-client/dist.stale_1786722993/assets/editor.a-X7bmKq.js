const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/wiki.Di9Vkhex.js","assets/utils.lBShoim5.js","assets/state.42sFgcOQ.js","assets/rolldown-runtime.BQ-_32WO.js","assets/Toast.DDAtBIAw.js","assets/preload-helper.BATLnrmA.js"])))=>i.map(i=>d[i]);
import{i as u}from"./utils.lBShoim5.js";import{D as E,P as I,b as y,o as B}from"./state.42sFgcOQ.js";import{n as s}from"./Toast.DDAtBIAw.js";import{t as x}from"./preload-helper.BATLnrmA.js";var l=null,v=null;function D(e){const t=y().wikiEntries||[];let o=null,i=!1;e&&(o=t.find(a=>String(a.id)===String(e))),o||(i=!0,o={id:"local-"+Date.now()+"-"+Math.random().toString(36).substr(2,6),title:"",category:"lore",body:"",tags:[],cost:null,slot:"",source:"local"}),$(o,i)}function $(e,t){w();const o=document.createElement("div");o.className="editor-screen-host",o.id="wiki-editor-modal";const i=document.createElement("div");i.className="editor-screen",i.style.maxWidth="800px",i.style.margin="0 auto",i.innerHTML=`
        <button class="btn btn-secondary editor-back" id="wiki-editor-close">← Back</button>
        <h2>${t?"📝 Create Wiki Entry":`✏️ Edit: ${e.title}`}</h2>

        <form id="wiki-editor-form">
            <!-- Title -->
            <div class="form-group">
                <label for="wiki-editor-title">Title *</label>
                <input type="text" id="wiki-editor-title" value="${u(e.title)}" placeholder="Entry title" required />
            </div>

            <!-- Category -->
            <div class="form-group">
                <label for="wiki-editor-category">Category</label>
                <select id="wiki-editor-category">
                    <option value="rules" ${e.category==="rules"?"selected":""}>📜 Rules</option>
                    <option value="patrons" ${e.category==="patrons"?"selected":""}>👁️ Patrons</option>
                    <option value="regions" ${e.category==="regions"?"selected":""}>🌍 Regions</option>
                    <option value="magic" ${e.category==="magic"?"selected":""}>🔮 Magic</option>
                    <option value="combat" ${e.category==="combat"?"selected":""}>⚔️ Combat</option>
                    <option value="lore" ${e.category==="lore"?"selected":""}>📚 Lore</option>
                    <option value="talents" ${e.category==="talents"?"selected":""}>🧠 Talents</option>
                    <option value="assets" ${e.category==="assets"?"selected":""}>🏛️ Assets</option>
                    <option value="equipment" ${e.category==="equipment"?"selected":""}>⚒️ Equipment</option>
                    <option value="characters" ${e.category==="characters"?"selected":""}>👤 Characters</option>
                    <option value="monsters" ${e.category==="monsters"?"selected":""}>🐉 Monsters</option>
                    <option value="other" ${e.category==="other"?"selected":""}>📌 Other</option>
                </select>
            </div>

            <!-- Tags -->
            <div class="form-group">
                <label for="wiki-editor-tags">Tags (comma separated)</label>
                <input type="text" id="wiki-editor-tags" value="${u((e.tags||[]).join(", "))}" placeholder="e.g., combat, magic, reference" />
            </div>

            <!-- Cost -->
            <div class="form-group" style="display:inline-block;width:48%;margin-right:2%;">
                <label for="wiki-editor-cost">XP Cost</label>
                <input type="number" id="wiki-editor-cost" value="${e.cost!=null?e.cost:""}" placeholder="e.g., 5" min="0" />
            </div>

            <!-- Slot -->
            <div class="form-group" style="display:inline-block;width:48%;">
                <label for="wiki-editor-slot">Slot</label>
                <input type="text" id="wiki-editor-slot" value="${u(e.slot||"")}" placeholder="e.g., Head, Weapon" />
            </div>

            <!-- Body -->
            <div class="form-group">
                <label for="wiki-editor-body">Content (Markdown supported)</label>
                <div style="display:flex;gap:0.5rem;margin-bottom:0.3rem;">
                    <button type="button" class="btn btn-xs btn-ghost markdown-help-btn" title="Markdown help">ℹ️</button>
                    <span style="font-size:0.7rem;color:var(--text3);">Supports: **bold**, *italic*, # headings, - lists, [links](url)</span>
                </div>
                <textarea id="wiki-editor-body" rows="12" placeholder="Write your wiki content here...">${u(e.body||"")}</textarea>
            </div>

            <!-- Preview -->
            <div class="form-group">
                <label>
                    <input type="checkbox" id="wiki-editor-preview-toggle" />
                    Show preview
                </label>
                <div id="wiki-editor-preview" style="display:none;background:var(--bg3);padding:1rem;border-radius:var(--radius);margin-top:0.5rem;max-height:300px;overflow-y:auto;">
                    <!-- Preview rendered here -->
                </div>
            </div>

            <!-- Buttons -->
            <div style="display:flex;gap:0.5rem;margin-top:1rem;flex-wrap:wrap;">
                <button type="submit" class="btn btn-gold" id="wiki-editor-save">💾 Save Entry</button>
                <button type="button" class="btn btn-danger" id="wiki-editor-delete" style="${t?"display:none;":""}">🗑️ Delete</button>
                <button type="button" class="btn" id="wiki-editor-cancel">Cancel</button>
            </div>
        </form>
    `,o.appendChild(i);const a=document.getElementById("app-content")||document.body;v=Array.from(a.children),v.forEach(c=>{c.style.display="none"}),a.appendChild(o),window.scrollTo({top:0}),l=o,t||(i.dataset.entryId=e.id),S(e,t)}function S(e,t){const o=document.getElementById("wiki-editor-form"),i=document.getElementById("wiki-editor-close"),a=document.getElementById("wiki-editor-cancel"),c=document.getElementById("wiki-editor-delete"),p=document.getElementById("wiki-editor-preview-toggle"),n=document.getElementById("wiki-editor-preview"),g=document.getElementById("wiki-editor-body"),m=document.querySelector(".markdown-help-btn"),r=()=>w();i.addEventListener("click",r),a.addEventListener("click",r),p.addEventListener("change",()=>{p.checked?(n.style.display="block",h(g.value,n)):n.style.display="none"}),g.addEventListener("input",()=>{p.checked&&h(g.value,n)}),m&&m.addEventListener("click",C),c&&c.addEventListener("click",()=>{const d=l.querySelector(".modal")?.dataset?.entryId;if(d&&confirm("Delete this entry?")){const k=y();k.wikiEntries=(k.wikiEntries||[]).filter(f=>String(f.id)!==String(d)),E(),w(),s("🗑️ Entry deleted.","success"),x(()=>import("./wiki.Di9Vkhex.js").then(f=>{f.renderWiki&&f.renderWiki()}),__vite__mapDeps([0,1,2,3,4,5]))}}),o.addEventListener("submit",d=>{d.preventDefault(),b(t)}),document.addEventListener("keydown",d=>{d.key==="Escape"&&r(),(d.ctrlKey||d.metaKey)&&d.key==="s"&&(d.preventDefault(),b(t))}),setTimeout(()=>{const d=document.getElementById("wiki-editor-title");d&&d.focus()},100)}function b(e){const t=document.getElementById("wiki-editor-title"),o=document.getElementById("wiki-editor-category"),i=document.getElementById("wiki-editor-tags"),a=document.getElementById("wiki-editor-cost"),c=document.getElementById("wiki-editor-slot"),p=document.getElementById("wiki-editor-body"),n=t.value.trim();if(!n){s("Please enter a title.","error"),t.focus();return}const g=y().wikiEntries||[];if(e&&g.some(r=>r.title.toLowerCase()===n.toLowerCase())){s(`Entry "${n}" already exists.`,"error"),t.focus();return}const m={title:n,category:o.value,tags:i.value.split(",").map(r=>r.trim()).filter(Boolean),cost:a.value!==""?parseInt(a.value):null,slot:c.value.trim(),body:p.value,source:"local"};if(e)m.id="local-"+Date.now()+"-"+Math.random().toString(36).substr(2,6),B(m),s(`✅ Created "${n}"`,"success");else{const r=l.querySelector(".modal")?.dataset?.entryId;if(!r){s("Error: Entry ID not found.","error");return}I(r,m),s(`✅ Updated "${n}"`,"success")}E(),w(),x(()=>import("./wiki.Di9Vkhex.js").then(r=>{r.renderWiki&&r.renderWiki()}),__vite__mapDeps([0,1,2,3,4,5]))}function L(e){if(!e)return"";const t=document.createElement("div");return t.innerHTML=e,t.querySelectorAll("script").forEach(o=>o.remove()),t.querySelectorAll("*").forEach(o=>{for(const i of o.attributes)i.name.startsWith("on")&&o.removeAttribute(i.name),(i.name==="href"||i.name==="src")&&i.value.trim().toLowerCase().startsWith("javascript:")&&o.removeAttribute(i.name)}),t.innerHTML}function h(e,t){try{if(window.marked){let o;typeof window.marked.parse=="function"?o=window.marked.parse(e):typeof window.marked=="function"&&(o=window.marked(e)),t.innerHTML=(o?L(o):"")||"<em>Empty content</em>"}else t.innerHTML=u(e).replace(/\n/g,"<br>")}catch{t.innerHTML=u(e).replace(/\n/g,"<br>")}}function C(){s(`
        <div style="font-size:0.85rem;line-height:1.6;">
            <h4>Markdown Quick Reference</h4>
            <table style="width:100%;border-collapse:collapse;font-size:0.85rem;">
                <tr><td><code>**bold**</code></td><td><strong>bold</strong></td></tr>
                <tr><td><code>*italic*</code></td><td><em>italic</em></td></tr>
                <tr><td><code># Heading</code></td><td># Heading</td></tr>
                <tr><td><code>- list item</code></td><td>• list item</td></tr>
                <tr><td><code>[text](url)</code></td><td><a href="#">text</a></td></tr>
                <tr><td><code>---</code></td><td>Horizontal rule</td></tr>
                <tr><td><code>> quote</code></td><td>blockquote</td></tr>
            </table>
            <p style="margin-top:0.5rem;">Full markdown support via <code>marked</code> library.</p>
        </div>
    `,"info",{html:!0,duration:8e3})}function w(){l&&l.parentNode&&(l.parentNode.removeChild(l),l=null),v&&(v.forEach(e=>{e.style.display=""}),v=null)}(function(){if(document.getElementById("wiki-editor-styles"))return;const t=document.createElement("style");t.id="wiki-editor-styles",t.textContent=`
        #wiki-editor-modal .form-group {
            margin-bottom: 1rem;
        }
        #wiki-editor-modal .form-group label {
            display: block;
            margin-bottom: 0.25rem;
            font-weight: 500;
            color: var(--text2);
            font-size: 0.9rem;
        }
        #wiki-editor-modal .form-group input,
        #wiki-editor-modal .form-group select,
        #wiki-editor-modal .form-group textarea {
            width: 100%;
            padding: 0.5rem 0.7rem;
            background: var(--bg3);
            border: 1px solid var(--border);
            border-radius: var(--radius-sm);
            color: var(--text);
            font-family: var(--font);
            font-size: 0.95rem;
            transition: border-color 0.2s;
        }
        #wiki-editor-modal .form-group input:focus,
        #wiki-editor-modal .form-group select:focus,
        #wiki-editor-modal .form-group textarea:focus {
            outline: none;
            border-color: var(--gold);
            box-shadow: 0 0 0 3px var(--gold-glow);
        }
        #wiki-editor-modal .form-group textarea {
            font-family: var(--font-mono, monospace);
            font-size: 0.9rem;
            line-height: 1.6;
            resize: vertical;
        }
        #wiki-editor-modal .modal {
            max-height: 90vh;
            overflow-y: auto;
        }
        #wiki-editor-modal .modal .close {
            position: sticky;
            float: right;
            top: 0;
            z-index: 10;
        }
        #wiki-editor-modal .btn-xs {
            padding: 0.1rem 0.5rem;
            font-size: 0.7rem;
        }
        #wiki-editor-modal .markdown-help-btn {
            background: var(--bg4);
            border-radius: 50%;
            width: 24px;
            height: 24px;
            padding: 0;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            border: 1px solid var(--border);
            cursor: pointer;
            color: var(--text2);
        }
        #wiki-editor-modal .markdown-help-btn:hover {
            background: var(--gold);
            color: var(--bg);
        }
        #wiki-editor-preview {
            background: var(--bg3);
            padding: 1rem;
            border-radius: var(--radius-sm);
            max-height: 300px;
            overflow-y: auto;
        }
        #wiki-editor-preview h1, #wiki-editor-preview h2, #wiki-editor-preview h3 {
            color: var(--gold);
        }
        #wiki-editor-preview a {
            color: var(--gold);
            text-decoration: underline;
        }
        #wiki-editor-preview ul, #wiki-editor-preview ol {
            padding-left: 1.5rem;
        }
        #wiki-editor-preview blockquote {
            border-left: 3px solid var(--gold);
            padding-left: 1rem;
            color: var(--text2);
            margin: 0.5rem 0;
        }
    `,document.head.appendChild(t)})();export{D as openEditor};
