import{i as p}from"./utils.lBShoim5.js";import{D as T,b as I}from"./state.42sFgcOQ.js";import{n as l}from"./Toast.DDAtBIAw.js";var b={backlog:{title:"📋 Backlog",icon:"📋",color:"#6a6680"},planning:{title:"📝 Planning",icon:"📝",color:"#5a8ab5"},active:{title:"🔄 Active",icon:"🔄",color:"#d4af37"},blocked:{title:"🚫 Blocked",icon:"🚫",color:"#c45a5a"},review:{title:"👀 Review",icon:"👀",color:"#8b6bb5"},done:{title:"✅ Done",icon:"✅",color:"#6baa7a"}},k={campaign:{label:"Campaign",icon:"🏛️",desc:"Long-term front pressure"},scene:{label:"Scene",icon:"🎬",desc:"Current scene timer"},situation:{label:"Situation",icon:"⚡",desc:"Immediate goal pressure"}},h=null,i={items:[],clocks:[],viewMode:"kanban"};function v(){const e=I();e.kanban?(i.items=e.kanban.items||[],i.clocks=e.kanban.clocks||[]):(i.items=M(),i.clocks=E(),r())}function r(){const e=I();e.kanban||(e.kanban={}),e.kanban.items=i.items,e.kanban.clocks=i.clocks,T()}function M(){return[{id:"item-1",title:"Session Zero Prep",description:"Create character sheets, set Lines & Veils, discuss campaign tone",column:"planning",priority:"high",timer:{segments:4,current:0},createdAt:Date.now(),updatedAt:Date.now(),tags:["session-zero","prep"]},{id:"item-2",title:"The Crown Spread",description:"Draw cards for campaign arc: Root, Crest, Crown, Left Hand, Wild",column:"active",priority:"high",timer:{segments:6,current:2},createdAt:Date.now(),updatedAt:Date.now(),tags:["crown-spread","planning"]},{id:"item-3",title:"Faction Turn",description:"Advance faction agendas and timers",column:"backlog",priority:"medium",timer:{segments:4,current:0},createdAt:Date.now(),updatedAt:Date.now(),tags:["factions","turn"]},{id:"item-4",title:"Ritual Completion",description:"Cult ritual timer - needs to be stopped before completion",column:"active",priority:"critical",timer:{segments:6,current:4},createdAt:Date.now(),updatedAt:Date.now(),tags:["timers","urgent"]},{id:"item-5",title:"Travel to the Ford",description:"Party is traveling to Valvano Ford - handle encounters",column:"blocked",priority:"medium",timer:{segments:8,current:3},createdAt:Date.now(),updatedAt:Date.now(),tags:["travel","encounters"],blockReason:"Weather conditions - waiting for storm to pass"},{id:"item-6",title:"NPC: Tema's Background",description:"Develop Tema's backstory and connections to the party",column:"review",priority:"low",timer:null,createdAt:Date.now(),updatedAt:Date.now(),tags:["npcs","lore"]},{id:"item-7",title:"Campaign Notes",description:"Document session summary and update campaign worksheet",column:"done",priority:"low",timer:null,createdAt:Date.now(),updatedAt:Date.now(),tags:["notes","documentation"]}]}function E(){return[{id:"clock-1",type:"campaign",name:"Cult Influence",segments:8,current:3,description:"The cult is gaining power in the region",visible:!0,color:"#c45a5a"},{id:"clock-2",type:"scene",name:"Ritual Completion",segments:6,current:4,description:"The ritual is nearing completion",visible:!0,color:"#d4af37"},{id:"clock-3",type:"situation",name:"Bridge Collapse",segments:4,current:1,description:"The bridge is unstable and may collapse",visible:!0,color:"#e8a07a"}]}function B(e){h=e,v(),h.innerHTML=`
        <div class="kanban-modern-layout">
            <!-- Header -->
            <header class="kanban-header">
                <h1 class="kanban-title">📋 Campaign Board</h1>
                <p class="kanban-subtitle">Track campaign progress, timers, and scene clocks.</p>
            </header>

            <!-- Navigation Tabs -->
            <div class="kanban-tabs">
                <button class="kanban-tab active" data-view="kanban">📋 Board</button>
                <button class="kanban-tab" data-view="clocks">⏱️ Clocks</button>
                <button class="kanban-tab" data-view="timeline">📊 Timeline</button>
            </div>

            <!-- View Container -->
            <div id="kanban-view-container" class="kanban-view-container">
                ${y("kanban")}
            </div>

            <!-- Modals -->
            <div id="kanban-modal" class="kanban-modal" style="display:none;"></div>
        </div>
    `,D()}function y(e){switch(i.viewMode=e,e){case"kanban":return A();case"clocks":return x();case"timeline":return R();default:return A()}}function A(){return`
        <div class="kanban-board-view">
            <div class="kanban-toolbar">
                <button class="btn btn-sm btn-primary" onclick="window.addKanbanItem()">➕ Add Item</button>
                <button class="btn btn-sm btn-secondary" onclick="window.refreshKanban()">🔄 Refresh</button>
                <span class="text-muted" style="font-size:0.8rem;">${i.items.length} items</span>
            </div>
            <div class="kanban-board-grid">
                ${Object.entries(b).map(([e,t])=>{const n=i.items.filter(o=>o.column===e),a=n.length,s=n.filter(o=>o.priority==="critical"||o.priority==="high").length;return`
                        <div class="kanban-col" data-column="${e}">
                            <div class="kanban-col-header" style="border-bottom:3px solid ${t.color};">
                                <span class="col-title">${t.icon} ${t.title}</span>
                                <span class="col-count">${a}</span>
                                ${s>0?`<span class="col-active" style="color:${t.color};">⚡${s}</span>`:""}
                            </div>
                            <div class="kanban-col-items" data-column="${e}">
                                ${n.length===0?'<div class="kanban-empty">Drop items here</div>':""}
                                ${n.map(o=>L(o)).join("")}
                            </div>
                        </div>
                    `}).join("")}
            </div>
        </div>
    `}function L(e){const t=e.priority==="critical"?"#c45a5a":e.priority==="high"?"#e8a07a":e.priority==="medium"?"#d4af37":"#6a6680",n=e.priority==="critical"?"🔥":e.priority==="high"?"⬆":e.priority==="medium"?"➖":"⬇",a=e.timer?`
        <div class="card-timer">
            <div class="timer-track">
                <div class="timer-fill" style="width:${e.timer.current/e.timer.segments*100}%;"></div>
            </div>
            <span class="timer-label">${e.timer.current}/${e.timer.segments}</span>
        </div>
    `:"",s=(e.tags||[]).slice(0,3).map(u=>`<span class="card-tag">#${p(u)}</span>`).join(""),o=(e.tags||[]).length>3?`<span class="card-tag more">+${(e.tags||[]).length-3}</span>`:"",m=e.blockReason?`
        <div class="card-block-reason">🚫 ${p(e.blockReason)}</div>
    `:"";return`
        <div class="kanban-card" data-id="${e.id}" draggable="true">
            <div class="card-header">
                <span class="card-title">${p(e.title)}</span>
                <span class="card-priority" style="color:${t};">${n}</span>
            </div>
            <div class="card-description">${p(e.description)}</div>
            ${m}
            ${a}
            <div class="card-footer">
                <div class="card-tags">${s}${o}</div>
                <div class="card-actions">
                    <button class="btn btn-xs btn-ghost" onclick="window.editKanbanItem('${e.id}')">✏️</button>
                    <button class="btn btn-xs btn-danger" onclick="window.deleteKanbanItem('${e.id}')">✕</button>
                </div>
            </div>
        </div>
    `}function x(){return`
        <div class="clocks-view">
            <div class="clocks-toolbar">
                <button class="btn btn-sm btn-primary" onclick="window.addClock()">➕ Add Clock</button>
                <button class="btn btn-sm btn-secondary" onclick="window.refreshKanban()">🔄 Refresh</button>
            </div>
            <div class="clocks-grid">
                ${i.clocks.map(e=>{const t=k[e.type]||k.situation,n=e.current/e.segments*100,a=n>=80,s=n>=100;return`
                        <div class="clock-card" onclick="window.viewClock('${e.id}')">
                            <div class="clock-header">
                                <span class="clock-icon">${t.icon}</span>
                                <span class="clock-type">${t.label}</span>
                                <span class="clock-status ${s?"full":a?"urgent":"active"}">
                                    ${s?"⚠️ Full":a?"⚡ Urgent":"⏳ Active"}
                                </span>
                            </div>
                            <div class="clock-name">${p(e.name)}</div>
                            <div class="clock-description">${p(e.description||"")}</div>
                            <div class="clock-progress">
                                <div class="clock-track">
                                    <div class="clock-fill ${a?"urgent":""}" style="width:${n}%;"></div>
                                </div>
                                <span class="clock-value">${e.current}/${e.segments}</span>
                            </div>
                            <div class="clock-controls">
                                <button class="btn btn-xs btn-primary" onclick="event.stopPropagation();window.tickClock('${e.id}')">+1</button>
                                <button class="btn btn-xs btn-secondary" onclick="event.stopPropagation();window.untickClock('${e.id}')">-1</button>
                                <button class="btn btn-xs btn-danger" onclick="event.stopPropagation();window.deleteClock('${e.id}')">🗑️</button>
                            </div>
                        </div>
                    `}).join("")}
                ${i.clocks.length===0?'<div class="text-muted" style="padding:2rem;text-align:center;">No clocks created yet. Add one to track campaign pressure.</div>':""}
            </div>
        </div>
    `}function R(){Object.keys(b);const e=i.items.filter(c=>c.column==="done"),t=i.items.filter(c=>c.column==="active"||c.column==="review"),n=i.items.filter(c=>c.column==="backlog"||c.column==="planning"),a=i.items.filter(c=>c.column==="blocked"),s=i.items.length,o=e.length,m=t.length,u=a.length,C=n.length,g=s>0?o/s*100:0,w=s>0?m/s*100:0,f=s>0?u/s*100:0,$=s>0?C/s*100:0;return`
        <div class="timeline-view">
            <div class="timeline-stats">
                <div class="stat-card">
                    <span class="stat-value">${s}</span>
                    <span class="stat-label">Total Items</span>
                </div>
                <div class="stat-card" style="border-left:3px solid var(--green);">
                    <span class="stat-value">${o}</span>
                    <span class="stat-label">Done</span>
                </div>
                <div class="stat-card" style="border-left:3px solid var(--gold);">
                    <span class="stat-value">${m}</span>
                    <span class="stat-label">In Progress</span>
                </div>
                <div class="stat-card" style="border-left:3px solid var(--red);">
                    <span class="stat-value">${u}</span>
                    <span class="stat-label">Blocked</span>
                </div>
                <div class="stat-card" style="border-left:3px solid var(--text3);">
                    <span class="stat-value">${C}</span>
                    <span class="stat-label">Backlog</span>
                </div>
            </div>

            <div class="timeline-progress">
                <div class="progress-bar">
                    <div class="progress-segment done" style="width:${g}%;background:var(--green);" title="Done: ${g}%"></div>
                    <div class="progress-segment active" style="width:${w}%;background:var(--gold);" title="Active: ${w}%"></div>
                    <div class="progress-segment blocked" style="width:${f}%;background:var(--red);" title="Blocked: ${f}%"></div>
                    <div class="progress-segment backlog" style="width:${$}%;background:var(--text3);" title="Backlog: ${$}%"></div>
                </div>
                <div class="progress-labels">
                    <span>✅ Done (${Math.round(g)}%)</span>
                    <span>🔄 Active (${Math.round(w)}%)</span>
                    <span>🚫 Blocked (${Math.round(f)}%)</span>
                    <span>📋 Backlog (${Math.round($)}%)</span>
                </div>
            </div>

            <div class="timeline-items">
                <h3 style="color:var(--gold);margin-bottom:0.5rem;">📋 Recent Activity</h3>
                ${i.items.slice().sort((c,K)=>K.updatedAt-c.updatedAt).slice(0,10).map(c=>`
                    <div class="timeline-item" onclick="window.editKanbanItem('${c.id}')">
                        <span class="item-status ${c.column}">${b[c.column]?.icon||"📋"}</span>
                        <span class="item-title">${p(c.title)}</span>
                        <span class="item-date">${new Date(c.updatedAt).toLocaleDateString()}</span>
                    </div>
                `).join("")}
            </div>
        </div>
    `}function S(e){const t=i.items.find(a=>a.id===e);if(!t){l("Item not found","error");return}const n=document.getElementById("kanban-modal");n.style.display="block",n.innerHTML=`
        <div class="modal-content item-detail">
            <button class="modal-close" onclick="window.closeKanbanModal()">✕</button>
            <div class="item-detail-header">
                <h2>${p(t.title)}</h2>
                <span class="item-priority" style="color:${t.priority==="critical"?"var(--red)":t.priority==="high"?"var(--orange)":"var(--text3)"};">${t.priority||"Normal"}</span>
            </div>
            
            <div class="item-detail-body">
                <div class="item-detail-section">
                    <h3>📖 Description</h3>
                    <p>${p(t.description||"No description.")}</p>
                </div>
                
                <div class="item-detail-section">
                    <h3>📊 Status</h3>
                    <p>Column: ${b[t.column]?.title||t.column}</p>
                    <p>Created: ${new Date(t.createdAt).toLocaleString()}</p>
                    <p>Updated: ${new Date(t.updatedAt).toLocaleString()}</p>
                </div>
                
                ${t.timer?`
                <div class="item-detail-section">
                    <h3>⏱️ Timer</h3>
                    <div class="timer-display">
                        <span>${t.timer.current}/${t.timer.segments}</span>
                        <div class="timer-bar">
                            <div class="timer-bar-fill" style="width:${t.timer.current/t.timer.segments*100}%;"></div>
                        </div>
                    </div>
                    <div class="timer-controls">
                        <button class="btn btn-sm btn-primary" onclick="window.tickItemTimer('${t.id}')">+1</button>
                        <button class="btn btn-sm btn-secondary" onclick="window.resetItemTimer('${t.id}')">⟳ Reset</button>
                    </div>
                </div>
                `:""}
                
                ${t.blockReason?`
                <div class="item-detail-section">
                    <h3>🚫 Blocked Reason</h3>
                    <p>${p(t.blockReason)}</p>
                </div>
                `:""}
                
                <div class="item-detail-section">
                    <h3>🏷️ Tags</h3>
                    <div class="tag-list">
                        ${(t.tags||[]).map(a=>`<span class="tag">#${p(a)}</span>`).join("")}
                        ${(t.tags||[]).length===0?'<span class="text-muted">No tags</span>':""}
                    </div>
                </div>
            </div>
            
            <div class="item-detail-actions">
                <button class="btn btn-primary" onclick="window.editKanbanItem('${t.id}')">✏️ Edit</button>
                <button class="btn btn-secondary" onclick="window.moveKanbanItem('${t.id}', 'left')">⬅️ Move Left</button>
                <button class="btn btn-secondary" onclick="window.moveKanbanItem('${t.id}', 'right')">➡️ Move Right</button>
                <button class="btn btn-danger" onclick="window.deleteKanbanItem('${t.id}')">🗑️ Delete</button>
                <button class="btn btn-ghost" onclick="window.closeKanbanModal()">Close</button>
            </div>
        </div>
    `,n.addEventListener("click",a=>{a.target===n&&closeKanbanModal()})}function P(e){const t=i.clocks.find(o=>o.id===e);if(!t){l("Clock not found","error");return}const n=k[t.type]||k.situation,a=t.current/t.segments*100,s=document.getElementById("kanban-modal");s.style.display="block",s.innerHTML=`
        <div class="modal-content clock-detail">
            <button class="modal-close" onclick="window.closeKanbanModal()">✕</button>
            <div class="clock-detail-header">
                <span class="clock-icon-large">${n.icon}</span>
                <div>
                    <h2>${p(t.name)}</h2>
                    <div class="clock-detail-type">${n.label} Clock</div>
                </div>
            </div>
            
            <div class="clock-detail-body">
                <div class="clock-detail-section">
                    <h3>📖 Description</h3>
                    <p>${p(t.description||"No description.")}</p>
                </div>
                
                <div class="clock-detail-section">
                    <h3>⏱️ Progress</h3>
                    <div class="clock-progress-large">
                        <div class="clock-track">
                            <div class="clock-fill" style="width:${a}%;background:${a>=100?"var(--red)":a>=80?"var(--orange)":"var(--gold)"};"></div>
                        </div>
                        <span class="clock-value">${t.current}/${t.segments}</span>
                    </div>
                    <div class="timer-controls">
                        <button class="btn btn-sm btn-primary" onclick="window.tickClock('${t.id}')">+1</button>
                        <button class="btn btn-sm btn-secondary" onclick="window.untickClock('${t.id}')">-1</button>
                        <button class="btn btn-sm btn-warning" onclick="window.resetClock('${t.id}')">⟳ Reset</button>
                    </div>
                </div>
            </div>
            
            <div class="clock-detail-actions">
                <button class="btn btn-primary" onclick="window.editClock('${t.id}')">✏️ Edit</button>
                <button class="btn btn-danger" onclick="window.deleteClock('${t.id}')">🗑️ Delete</button>
                <button class="btn btn-ghost" onclick="window.closeKanbanModal()">Close</button>
            </div>
        </div>
    `,s.addEventListener("click",o=>{o.target===s&&closeKanbanModal()})}window.closeKanbanModal=function(){document.getElementById("kanban-modal").style.display="none"};window.viewKanbanItem=function(e){S(e)};window.viewClock=function(e){P(e)};window.addKanbanItem=function(){const e=prompt("Enter item title:");if(!e)return;const t=prompt("Enter description:")||"",n=prompt("Enter column (backlog/planning/active/blocked/review/done):","backlog")||"backlog",a=prompt("Enter priority (critical/high/medium/low):","medium")||"medium",s=confirm("Add a timer?");let o=null;s&&(o={segments:parseInt(prompt("Timer segments (4,6,8,10):","4")||"4"),current:0}),i.items.push({id:"item-"+Date.now(),title:e,description:t,column:n,priority:a,timer:o,tags:prompt("Tags (comma-separated):")?.split(",").map(m=>m.trim()).filter(Boolean)||[],createdAt:Date.now(),updatedAt:Date.now(),blockReason:n==="blocked"&&prompt("Blocked reason:")||""}),r(),d(),l(`📋 Added "${e}"`,"success")};window.editKanbanItem=function(e){const t=i.items.find(a=>a.id===e);if(!t)return;const n=prompt("Enter title:",t.title);n&&(t.title=n,t.description=prompt("Enter description:",t.description)||t.description,t.column=prompt("Enter column (backlog/planning/active/blocked/review/done):",t.column)||t.column,t.priority=prompt("Enter priority (critical/high/medium/low):",t.priority)||"medium",t.column==="blocked"&&(t.blockReason=prompt("Blocked reason:",t.blockReason)||""),t.updatedAt=Date.now(),r(),d(),closeKanbanModal(),l(`✏️ Updated "${n}"`,"success"))};window.deleteKanbanItem=function(e){const t=i.items.find(n=>n.id===e);t&&confirm(`Delete "${t.title}"?`)&&(i.items=i.items.filter(n=>n.id!==e),r(),d(),closeKanbanModal(),l(`🗑️ Deleted "${t.title}"`,"info"))};window.moveKanbanItem=function(e,t){const n=i.items.find(u=>u.id===e);if(!n)return;const a=["backlog","planning","active","review","done"],s=a.indexOf(n.column);if(s===-1)return;const o=t==="left"?s-1:s+1;if(o<0||o>=a.length){l("Cannot move further","warning");return}const m=a[o];if(m==="blocked"&&t!=="left"){l("Item must be moved to blocked manually with a reason","warning");return}n.column=m,n.updatedAt=Date.now(),m==="blocked"&&!n.blockReason&&(n.blockReason=prompt("Blocked reason:")||"Blocked"),m!=="blocked"&&(n.blockReason=""),r(),d(),closeKanbanModal(),l(`📋 Moved "${n.title}" to ${b[m]?.title||m}`,"success")};window.tickItemTimer=function(e){const t=i.items.find(n=>n.id===e);!t||!t.timer||(t.timer.current=Math.min(t.timer.current+1,t.timer.segments),t.updatedAt=Date.now(),r(),d(),t.timer.current>=t.timer.segments&&l(`⏱️ Timer for "${t.title}" completed!`,"warning"))};window.resetItemTimer=function(e){const t=i.items.find(n=>n.id===e);!t||!t.timer||(t.timer.current=0,t.updatedAt=Date.now(),r(),d(),closeKanbanModal(),l(`⟳ Timer reset for "${t.title}"`,"info"))};window.addClock=function(){const e=prompt("Enter clock type (campaign/scene/situation):","situation")||"situation",t=prompt("Enter clock name:");if(!t)return;const n=parseInt(prompt("Segments (4/6/8/10):","6")||"6"),a=prompt("Description:")||"";i.clocks.push({id:"clock-"+Date.now(),type:e,name:t,segments:n,current:0,description:a,visible:!0,color:e==="campaign"?"#c45a5a":e==="scene"?"#d4af37":"#e8a07a"}),r(),d(),l(`⏱️ Added "${t}" clock`,"success")};window.editClock=function(e){const t=i.clocks.find(a=>a.id===e);if(!t)return;const n=prompt("Enter name:",t.name);n&&(t.name=n,t.type=prompt("Enter type (campaign/scene/situation):",t.type)||t.type,t.segments=parseInt(prompt("Segments:",t.segments)||"6"),t.description=prompt("Description:",t.description)||"",r(),d(),closeKanbanModal(),l(`✏️ Updated "${n}" clock`,"success"))};window.deleteClock=function(e){const t=i.clocks.find(n=>n.id===e);t&&confirm(`Delete clock "${t.name}"?`)&&(i.clocks=i.clocks.filter(n=>n.id!==e),r(),d(),closeKanbanModal(),l(`🗑️ Deleted "${t.name}" clock`,"info"))};window.tickClock=function(e){const t=i.clocks.find(n=>n.id===e);t&&(t.current=Math.min(t.current+1,t.segments),r(),d(),t.current>=t.segments&&l(`⏱️ Clock "${t.name}" completed!`,"warning"))};window.untickClock=function(e){const t=i.clocks.find(n=>n.id===e);t&&(t.current=Math.max(t.current-1,0),r(),d())};window.resetClock=function(e){const t=i.clocks.find(n=>n.id===e);t&&(t.current=0,r(),d(),closeKanbanModal(),l(`⟳ Clock "${t.name}" reset`,"info"))};window.refreshKanban=function(){v(),d(),l("🔄 Kanban refreshed","success")};function d(){const e=document.getElementById("kanban-view-container");e&&(e.innerHTML=y(i.viewMode),D())}function D(){document.querySelectorAll(".kanban-tab").forEach(e=>{e.addEventListener("click",()=>{document.querySelectorAll(".kanban-tab").forEach(a=>a.classList.remove("active")),e.classList.add("active");const t=e.dataset.view,n=document.getElementById("kanban-view-container");n&&(n.innerHTML=y(t),D())})}),document.querySelectorAll('.kanban-card[draggable="true"]').forEach(e=>{e.addEventListener("dragstart",t=>{t.dataTransfer.setData("text/plain",e.dataset.id),e.style.opacity="0.5"}),e.addEventListener("dragend",t=>{e.style.opacity="1"})}),document.querySelectorAll(".kanban-col-items").forEach(e=>{e.addEventListener("dragover",t=>{t.preventDefault(),e.style.background="var(--bg4)"}),e.addEventListener("dragleave",t=>{e.style.background=""}),e.addEventListener("drop",t=>{t.preventDefault(),e.style.background="";const n=t.dataTransfer.getData("text/plain"),a=e.dataset.column,s=i.items.find(o=>o.id===n);s&&s.column!==a&&(a==="blocked"?s.blockReason=prompt("Blocked reason:")||"Blocked":s.blockReason="",s.column=a,s.updatedAt=Date.now(),r(),d(),l(`📋 Moved "${s.title}" to ${b[a]?.title||a}`,"success"))})})}function H(){console.log("[Kanban] Activated"),v()}function N(){console.log("[Kanban] Deactivated"),r()}function j(){v(),d()}function V(){h=null,r()}var q={render:B,destroy:V,onActivate:H,onDeactivate:N,refresh:j,loadKanbanData:v,saveKanbanData:r};export{D as attachEvents,q as default,V as destroy,H as onActivate,N as onDeactivate,j as refresh,B as render};
