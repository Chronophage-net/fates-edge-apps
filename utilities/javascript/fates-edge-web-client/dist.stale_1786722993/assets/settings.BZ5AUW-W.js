const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/sync.i5xh8ufD.js","assets/rolldown-runtime.BQ-_32WO.js","assets/state.42sFgcOQ.js","assets/utils.lBShoim5.js","assets/Toast.DDAtBIAw.js","assets/home.7wBj1mJ4.js","assets/preload-helper.BATLnrmA.js","assets/spellcraft.BTrFBpcK.js","assets/websocket.Dmklt06W.js","assets/patrons.Ci1TYIUN.js","assets/discovery.I-q7Uafb.js","assets/vtt-store.Dch8u3Zx.js"])))=>i.map(i=>d[i]);
import{i as o}from"./utils.lBShoim5.js";import{D as I,O as ee,b,h as W,k as F,m as S,s as te,t as se,u as ae,x as j}from"./state.42sFgcOQ.js";import{n as r}from"./Toast.DDAtBIAw.js";import{t as f}from"./preload-helper.BATLnrmA.js";import{M as ne,f as _,m as $,n as G,p as re,r as P}from"./websocket.Dmklt06W.js";import{a as oe,c as ie,d as B,g as R,h as le,i as ce,l as M,m as de,n as V,o as q,r as me,s as ue,t as pe,u as ge}from"./main.hiOZSyFC.js";import{loadAdventureFromFile as ve,loadAdventureManifest as be}from"./adventure-manager.BYGz956n.js";var p=null,O=!1,C="/data/adventures/",h=null,k=!1,E=null;function he(){return re()?le(de()):!0}async function fe(e){const t=[`${C}${e}.json`,`.${C}${e}.json`];for(const s of t)try{const a=await fetch(s);if(!a.ok)continue;const n=await a.json();return{id:e,title:n.title||e,tier:n.tierRange||n.tier||"",author:n.author||"",description:n.description||n.notes||"",sessions:n.sessions||""}}catch{}return{id:e,title:e,tier:"",author:"",description:"(Could not load metadata)",sessions:""}}async function ye(){k=!0,E=null,g(p);try{const e=await be();e===null?(E=`Couldn't reach manifest.json under ${C}.`,h=[]):h=await Promise.all(e.map(fe))}catch(e){E=e.message||String(e),h=[]}finally{k=!1,g(p)}}async function we(e,t){if(!he()){r("Only the GM can install adventure modules.","error");return}t&&(t.disabled=!0,t.textContent="⏳ Installing…");try{const s=await ve(e);s?r(`📚 Installed "${s.title}" into your adventure library.`,"success"):r(`Failed to install "${e}" — check the console for details.`,"error")}catch(s){r(`Failed to install "${e}": ${s.message||s}`,"error")}g(p)}var ke=`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║                     FATE'S EDGE                              ║
║                                                              ║
║                      COPYRIGHT NOTICE                        ║
║                                                              ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  Fate's Edge is © Nicholas A. Gasper. Used with permission, All rights reserved.   ║
║                                                              ║
║  ── Dual License ──                                          ║
║                                                              ║
║  The System Reference Document (SRD) and Essentials guide    ║
║  are licensed under the Creative Commons Attribution-        ║
║  NonCommercial-ShareAlike 4.0 International License          ║
║  (CC BY-NC-SA 4.0).                                          ║
║                                                              ║
║  ═════════════════════════════════════════════════════════   ║
║                                                              ║
║  ALL OTHER CONTENT IS ALL RIGHTS RESERVED, including but    ║
║  not limited to:                                             ║
║                                                              ║
║    • Setting lore (Acasia, Aeler, Vhasia, the Curse, etc.)  ║
║    • Original characters, NPCs, and named figures           ║
║    • Faction descriptions and campaign-specific content     ║
║    • Proprietary magic systems (Runekeeper, Invoker,        ║
║      Cantor, Summoner, etc.)                                ║
║    • Artwork, maps, and graphical elements                  ║
║    • Original prose, framing devices, and narrative text    ║
║    • The Deck of Consequences and Crown Spread systems      ║
║    • The Travel Framework and regional generators          ║
║    • Any content not explicitly marked as SRD              ║
║                                                              ║
║  ── Code License ──                                          ║
║                                                              ║
║  The source code for this toolkit is licensed under the     ║
║  MIT License. See the LICENSE file in the repository.       ║
║                                                              ║
║  ── Permissions ──                                           ║
║                                                              ║
║  For permissions regarding Copyright, contact:    ║
║  support@fates-edge.com                                     ║
║                                                              ║
║                                                              ║
║  "The coin that never spends is the one you don't           ║
║   remember taking."                                         ║
║          — Serafine of the Velvet Touch                     ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`,Ee=`
FATE'S EDGE — LICENSE SUMMARY
=============================

📜 Fate's Edge is © Nicholas A. Gasper. Used with permission, All rights reserved.

📖 The SRD and Essentials guide are licensed under 
   CC BY-NC-SA 4.0 (Creative Commons Attribution-NonCommercial-ShareAlike 4.0)

🔒 ALL OTHER CONTENT is All Rights Reserved:
   • Setting lore, original characters, factions
   • Proprietary magic systems (Runekeeper, Invoker, Cantor, etc.)
   • Artwork, maps, graphical elements
   • Original prose, narrative text
   • Deck of Consequences, Crown Spread, Travel Framework
   • Any content not explicitly marked as SRD

💻 The toolkit source code is MIT Licensed.

📧 For permissions: support@fates-edge.com

"The coin that never spends is the one you don't remember taking."
— Serafine of the Velvet Touch
`,x="wss://fates-edge-socket-server.onrender.com",N="vtt-room",v="https://fates-edge-socket-server.onrender.com";function g(e){p=e;const t=b(),s=S(),a=t.settings||{},n=localStorage.getItem("fates-edge-server-url")||v,i=localStorage.getItem("fates-edge-user-email")||"",l=localStorage.getItem("fates-edge-client-name")||"",d=localStorage.getItem("fates-edge-show-avatars")!=="false",u=localStorage.getItem("fates-edge-use-gravatars")!=="false",m=localStorage.getItem("fates-edge-auth-username")||"",y=$?$():!1;_&&_();const w=V(),U=pe(),H=new Set((t.adventures||[]).map(c=>c.id));p.innerHTML=`
        <div class="settings-layout">
            <style>
                /* ─── Settings Panel Header Fix ───────────────────────────── */
                .settings-header {
                    background: var(--bg2);
                    padding: 1rem 1.2rem;
                    border-radius: var(--radius);
                    border: 1px solid var(--border);
                    margin-bottom: 1rem;
                }
                .settings-header .page-title {
                    margin: 0;
                    color: var(--gold);
                }
                .settings-header .page-sub {
                    margin: 0.1rem 0 0;
                    color: var(--text3);
                    font-size: 0.9rem;
                }
                /* ─── Tours panel ─────────────────────────────────────────── */
                .settings-tours .flex {
                    gap: 0.5rem;
                    flex-wrap: wrap;
                }
                /* ─── Stats bar ───────────────────────────────────────────── */
                .settings-stats {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
                    gap: 0.5rem;
                    margin-bottom: 1rem;
                }
                .stat-item {
                    background: var(--bg2);
                    padding: 0.5rem 0.8rem;
                    border-radius: var(--radius);
                    border: 1px solid var(--border);
                    text-align: center;
                }
                .stat-label {
                    font-size: 0.65rem;
                    color: var(--text3);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    display: block;
                }
                .stat-value {
                    font-size: 1.1rem;
                    font-weight: 700;
                    color: var(--text);
                }
                .stat-value.enabled { color: var(--green); }
                .stat-value.disabled { color: var(--text3); }
                /* ─── Sync status ──────────────────────────────────────────── */
                .sync-status {
                    padding: 0.3rem 0.6rem;
                    border-radius: var(--radius);
                    margin-top: 0.5rem;
                    font-size: 0.9rem;
                }
                .sync-status.connected {
                    background: rgba(76, 175, 80, 0.12);
                    color: var(--green);
                    border: 1px solid var(--green);
                }
                .sync-status.disconnected {
                    background: rgba(244, 67, 54, 0.08);
                    color: var(--red);
                    border: 1px solid var(--red);
                }
                .sync-status.connecting {
                    background: rgba(255, 193, 7, 0.12);
                    color: var(--gold);
                    border: 1px solid var(--gold);
                }
                .sync-status.error {
                    background: rgba(244, 67, 54, 0.12);
                    color: var(--red);
                    border: 1px solid var(--red);
                }
                .status-badge {
                    display: inline-block;
                    padding: 0.1rem 0.6rem;
                    border-radius: 12px;
                    font-size: 0.75rem;
                    font-weight: 600;
                }
                .status-badge.connected {
                    background: rgba(76, 175, 80, 0.15);
                    color: var(--green);
                }
                .status-badge.disconnected {
                    background: rgba(244, 67, 54, 0.1);
                    color: var(--red);
                }
                /* ─── Avatar preview ───────────────────────────────────────── */
                .avatar-preview-container {
                    display: flex;
                    align-items: center;
                    gap: 0.8rem;
                    padding: 0.3rem 0.6rem;
                    background: var(--bg3);
                    border-radius: var(--radius);
                    margin: 0.3rem 0;
                }
                .avatar-preview-container img {
                    border-radius: 50%;
                    border: 2px solid var(--border);
                    width: 48px;
                    height: 48px;
                    object-fit: cover;
                }
                .avatar-name {
                    font-weight: 600;
                    color: var(--text);
                }
                .avatar-email {
                    font-size: 0.8rem;
                    color: var(--text3);
                }
                /* ─── Presence list ────────────────────────────────────────── */
                .presence-list {
                    max-height: 120px;
                    overflow-y: auto;
                    padding: 0.2rem 0.4rem;
                    background: var(--bg3);
                    border-radius: var(--radius);
                }
                .presence-item {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.2rem 0.3rem;
                    border-bottom: 1px solid var(--border);
                }
                .presence-item:last-child { border-bottom: none; }
                .presence-item .avatar {
                    width: 28px;
                    height: 28px;
                    border-radius: 50%;
                    object-fit: cover;
                }
                .presence-item .name { flex: 1; font-weight: 500; font-size: 0.85rem; }
                .presence-item .role { font-size: 0.65rem; color: var(--text3); }
                .presence-item .status-dot {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    display: inline-block;
                }
                .presence-item .status-dot.online { background: var(--green); }
                .presence-item .status-dot.away { background: var(--gold); }
                /* ─── Password status ──────────────────────────────────────── */
                .password-status-badge {
                    font-size: 0.7rem;
                    padding: 0.1rem 0.6rem;
                    border-radius: 12px;
                    font-weight: 600;
                }
                .password-status-badge.enabled {
                    background: rgba(76, 175, 80, 0.15);
                    color: var(--green);
                }
                .password-status-badge.disabled {
                    background: rgba(244, 67, 54, 0.1);
                    color: var(--text3);
                }
                .password-settings-row {
                    display: grid;
                    grid-template-columns: 1fr 1fr 1fr;
                    gap: 0.5rem;
                    margin-bottom: 0.5rem;
                }
                @media (max-width: 700px) {
                    .password-settings-row {
                        grid-template-columns: 1fr;
                    }
                }
                /* ─── Session archives ────────────────────────────────────── */
                .session-archive-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 0.3rem 0.5rem;
                    border-bottom: 1px solid var(--border);
                }
                .session-archive-item:last-child { border-bottom: none; }
                .session-archive-item .name { font-weight: 500; }
                .session-archive-item .meta { font-size: 0.7rem; color: var(--text3); }
                /* ─── Pack list ───────────────────────────────────────────── */
                .pack-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 0.3rem 0.5rem;
                    border-bottom: 1px solid var(--border);
                }
                .pack-item:last-child { border-bottom: none; }
                .pack-item .pack-name { font-weight: 500; }
                .pack-item .pack-version { font-size: 0.65rem; color: var(--text2); background: var(--bg3); padding: 0.05rem 0.4rem; border-radius: 8px; }
                .pack-item .pack-type { font-size: 0.6rem; color: var(--text3); text-transform: uppercase; }
                .pack-item .pack-meta { font-size: 0.7rem; color: var(--text3); }
                .pack-document-item {
                    display: inline-block;
                    padding: 0.1rem 0.5rem;
                    margin: 0.1rem;
                    background: var(--bg3);
                    border-radius: 12px;
                    font-size: 0.75rem;
                }
                .pack-document-item .doc-title { color: var(--text); }
                .pack-document-item .doc-category { color: var(--text3); margin-left: 0.3rem; font-size: 0.65rem; }
                .campaign-feedback {
                    padding: 0.3rem 0.6rem;
                    border-radius: var(--radius);
                    font-size: 0.85rem;
                    min-height: 1.5rem;
                }
                .campaign-feedback.success { color: var(--green); background: rgba(76,175,80,0.08); border: 1px solid var(--green); }
                .campaign-feedback.error { color: var(--red); background: rgba(244,67,54,0.08); border: 1px solid var(--red); }
                .license-box {
                    background: var(--bg3);
                    padding: 0.8rem 1rem;
                    border-radius: var(--radius);
                    font-size: 0.8rem;
                    color: var(--text2);
                    border: 1px solid var(--border);
                }
                .license-box p { margin: 0.3rem 0; }
                .bundled-packs-hint {
                    background: var(--bg3);
                    padding: 0.7rem 0.9rem;
                    border-radius: var(--radius);
                    border: 1px solid var(--border);
                    border-left: 3px solid var(--gold);
                }
                .bundled-packs-hint code {
                    background: var(--bg4);
                    padding: 0.05rem 0.3rem;
                    border-radius: 4px;
                    font-size: 0.75rem;
                    color: var(--text2);
                    word-break: break-all;
                }
                .theme-btn.active { border-color: var(--gold); background: var(--bg4); }
                .theme-status-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.35rem;
                    padding: 0.3rem 0.6rem;
                    border-radius: var(--radius);
                    background: var(--bg3);
                    border: 1px solid var(--border);
                    font-size: 0.85rem;
                }
                .theme-status-badge .dot {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background: var(--green);
                    display: inline-block;
                }
                .theme-status-badge .source-tag {
                    font-size: 0.65rem;
                    color: var(--text3);
                    text-transform: uppercase;
                    letter-spacing: 0.03em;
                    background: var(--bg4);
                    padding: 0.05rem 0.4rem;
                    border-radius: 8px;
                    margin-left: 0.2rem;
                }
            </style>

            <header class="settings-header">
                <h1 class="page-title">⚙️ Settings</h1>
                <p class="page-sub">Manage your data, backups, and preferences.</p>
            </header>

            <!-- ============================================================
                 QUICK STATS BAR
                 ============================================================ -->
            <div class="settings-stats">
                <div class="stat-item"><span class="stat-label">💾 Storage</span><span class="stat-value">Local</span></div>
                <div class="stat-item"><span class="stat-label">📦 Archives</span><span class="stat-value">${s.length}</span></div>
                <div class="stat-item"><span class="stat-label">📚 Packs</span><span class="stat-value">${w.length}</span></div>
                <div class="stat-item"><span class="stat-label">🔐 Password</span><span class="stat-value ${t.passwordHash?"enabled":"disabled"}">${t.passwordHash?"✅ Set":"❌ Not set"}</span></div>
            </div>
            
            <!-- ============================================================
                 PACK MANAGEMENT
                 ============================================================ -->
            <div class="panel settings-panel" id="pack-management-panel">
                <div class="panel-header">
                    <h3>📦 Pack Management</h3>
                    <span class="badge pack-count">${w.length} installed</span>
                </div>
                <p class="text-muted small">Install custom packs to extend the toolkit with new modules, documents, and data.</p>

                <div class="bundled-packs-hint mt-1">
                    <strong style="color:var(--gold);">📚 Bundled theme packs</strong>
                    <p class="text-sm" style="margin:0.3rem 0;">Two ready-to-install theme packs ship in the <strong>docs repo</strong> (fates-edge-docs), not this one — each bundles a full reskin (colors, borders, glow/vignette treatment) plus a matching faction, region, and quick-reference doc:</p>
                    <ul class="text-sm" style="margin:0.2rem 0 0.3rem 1.2rem;">
                        <li><strong>🌆 Modern Noir</strong> — <code>ttrpg/reference/expansions/modern-noir-module/web-client/modern-noir-module.pack.zip</code></li>
                        <li><strong>🕯️ Horror</strong> — <code>ttrpg/reference/expansions/horror-module/web-client/horror-module.pack.zip</code></li>
                    </ul>
                    <p class="text-xs text-muted" style="margin:0;">Grab the .zip from that repo and install it below. Once installed, the theme shows up in Theme &amp; Appearance further down this page.</p>
                </div>

                <div class="form-row">
                    <div class="field" style="flex:3;">
                        <label>Install Pack</label>
                        <input type="file" id="pack-file-input" accept=".zip" />
                        <div class="field-hint">Select a .zip pack file to install</div>
                    </div>
                </div>
                
                <div class="flex">
                    <button class="btn btn-gold" id="pack-install-btn">📦 Install Pack</button>
                    <button class="btn btn-sm btn-secondary" id="pack-refresh-btn">↻ Refresh</button>
                </div>
                
                <div id="pack-install-feedback" class="mt-1" style="min-height:1.5rem;"></div>
                
                <div class="mt-1">
                    <h4 style="margin:0.5rem 0 0.2rem;font-size:0.95rem;">📋 Installed Packs</h4>
                    <div id="pack-list" class="pack-list">
                        ${w.length===0?'<div class="text-muted small">No packs installed.</div>':""}
                        ${w.map(c=>`
                            <div class="pack-item">
                                <div class="pack-info">
                                    <span class="pack-name">${o(c.name)}</span>
                                    <span class="pack-version">v${o(c.version)}</span>
                                    <span class="pack-type">${c.type}</span>
                                    ${c.theme?`<span class="pack-type" title="This pack registers a theme: ${o(c.theme.label)}">🎨 theme</span>`:""}
                                    <span class="pack-meta">${c.author?`by ${o(c.author)}`:""} · ${new Date(c.installed).toLocaleDateString()}</span>
                                </div>
                                <div class="flex">
                                    <button class="btn btn-xs btn-danger uninstall-pack-btn" data-id="${c.id}">🗑️ Uninstall</button>
                                </div>
                            </div>
                        `).join("")}
                    </div>
                </div>
                
                <div class="mt-1">
                    <h4 style="margin:0.5rem 0 0.2rem;font-size:0.95rem;">📄 Pack Documents</h4>
                    <div id="pack-documents-list">
                        ${U.length===0?'<div class="text-muted small">No documents loaded from packs.</div>':""}
                        ${U.map(c=>`
                            <div class="pack-document-item">
                                <span class="doc-title">${o(c.title)}</span>
                                <span class="doc-category">${o(c.category||"general")}</span>
                            </div>
                        `).join("")}
                    </div>
                </div>
            </div>

            <!-- ============================================================
                 ADVENTURE MODULE LIBRARY (one-click install)
                 ============================================================ -->
            <div class="panel settings-panel" id="adventure-library-panel">
                <div class="panel-header">
                    <h3>🗺️ Adventure Module Library</h3>
                    <span class="badge">${H.size} installed</span>
                </div>
                <p class="text-muted small">Browse adventure modules bundled in the local <code>${C}</code> folder and install them into your library in one click — no manual JSON placement or modal needed.</p>

                <div class="flex">
                    <button class="btn btn-gold" id="adventure-library-browse-btn">📚 ${h===null?"Browse Library":"Refresh List"}</button>
                </div>

                ${E?`<div class="mt-1" style="color:var(--red);">⚠️ ${o(E)}</div>`:""}

                <div class="mt-1" id="adventure-library-list">
                    ${k?'<div class="text-muted small">⏳ Loading module list…</div>':""}
                    ${!k&&h===null?'<div class="text-muted small">Click "Browse Library" to see available modules.</div>':""}
                    ${!k&&h!==null&&h.length===0&&!E?'<div class="text-muted small">No modules found.</div>':""}
                    ${!k&&h?h.map(c=>{const T=H.has(c.id);return`
                            <div class="pack-item" style="align-items:flex-start;">
                                <div class="pack-info" style="flex:1;">
                                    <span class="pack-name">${o(c.title)}</span>
                                    ${c.tier?`<span class="pack-type">Tier ${o(c.tier)}</span>`:""}
                                    ${c.sessions?`<span class="pack-type">${o(c.sessions)} sessions</span>`:""}
                                    <div class="pack-meta">${c.author?`by ${o(c.author)}`:""}</div>
                                    <div class="text-sm text-muted" style="margin-top:0.2rem;max-width:520px;">${o(c.description)}</div>
                                </div>
                                <div class="flex" style="flex-shrink:0;">
                                    <button class="btn btn-xs ${T?"btn-secondary":"btn-gold"} adventure-install-btn" data-id="${o(c.id)}" ${T?"disabled":""}>
                                        ${T?"✅ Installed":"⬇️ Install"}
                                    </button>
                                </div>
                            </div>
                        `}).join(""):""}
                </div>
            </div>

            <!-- ============================================================
                 WEBSOCKET SETTINGS
                 ============================================================ -->
            <div class="panel settings-panel">
                <div class="panel-header">
                    <h3>🔗 WebSocket Connection</h3>
                    <span class="badge ${y?"connected":"disconnected"}">${y?"🟢 Connected":"🔴 Disconnected"}</span>
                </div>
                <p class="text-muted small">Configure the WebSocket server for real-time VTT features. Default: <strong>${x}</strong></p>
                
                <div class="form-row">
                    <div class="field" style="flex:3;">
                        <label>WebSocket Server URL</label>
                        <input type="text" id="settings-ws-url" 
                               value="${o(a.wsUrl||x)}" 
                               placeholder="${x}" />
                        <div class="field-hint">The WebSocket server URL for VTT synchronization</div>
                    </div>
                    <div class="field" style="flex:1;">
                        <label>Room Name</label>
                        <input type="text" id="settings-ws-room" 
                               value="${o(a.wsRoom||N)}" 
                               placeholder="${N}" />
                        <div class="field-hint">Room to join for multiplayer</div>
                    </div>
                </div>
                
                <div class="form-row">
                    <div class="field" style="flex:0 0 auto;">
                        <label class="inline-check">
                            <input type="checkbox" id="settings-ws-enabled" 
                                   ${a.wsEnabled!==!1?"checked":""} />
                            Enable WebSocket
                        </label>
                    </div>
                    <div class="field" style="flex:0 0 auto;">
                        <label class="inline-check">
                            <input type="checkbox" id="settings-ws-reconnect" 
                                   ${a.wsReconnect!==!1?"checked":""} />
                            Auto-reconnect
                        </label>
                    </div>
                    <div class="field" style="flex:0 0 120px;">
                        <label>Reconnect Interval</label>
                        <input type="number" id="settings-ws-interval" 
                               value="${a.wsReconnectInterval||3e3}" 
                               min="1000" max="10000" step="500" />
                        <div class="field-hint">ms between reconnect attempts</div>
                    </div>
                </div>
                
                <div class="flex">
                    <button class="btn btn-sm btn-secondary" id="settings-ws-test">🔍 Test Connection</button>
                    <button class="btn btn-sm btn-gold" id="settings-ws-connect">🔗 Connect</button>
                    <button class="btn btn-sm btn-secondary" id="settings-ws-disconnect">🔌 Disconnect</button>
                    <span id="settings-ws-status" class="status-badge ${y?"connected":"disconnected"}">
                        ${y?"🟢 Connected":"🔴 Disconnected"}
                    </span>
                </div>
                
                <div id="settings-ws-result" class="mt-1" style="display:none;"></div>
            </div>
            
            <!-- ============================================================
                 ACCOUNT (optional)
                 ============================================================ -->
            <div class="panel settings-panel" id="account-panel">
                <div class="panel-header">
                    <h3>🔐 Account <span class="text-muted small">(optional)</span></h3>
                    <span id="account-status-badge" class="badge ${m?"":"disconnected"}">${m?`✅ ${o(m)}`:"🔴 Not logged in"}</span>
                </div>
                <p class="text-muted small">
                    Completely optional. Without an account, joining a campaign works exactly as before --
                    you'll just need the room password every time. With an account, a GM can let you back into
                    a password-protected room without re-entering it, and bans against your account stick even
                    across reconnects. Accounts require the server you're connecting to have database storage
                    configured -- ask your GM/host if registration fails.
                </p>
                ${m?`
                <div class="flex">
                    <button class="btn btn-sm btn-danger" id="account-logout-btn">🚪 Log Out (${o(m)})</button>
                </div>
                `:`
                <div class="form-row">
                    <div class="field">
                        <label>Username</label>
                        <input type="text" id="account-username" placeholder="3-32 chars, letters/numbers/_/-" />
                    </div>
                    <div class="field">
                        <label>Password</label>
                        <input type="password" id="account-password" placeholder="8+ characters" />
                    </div>
                </div>
                <div class="flex">
                    <button class="btn btn-sm btn-gold" id="account-login-btn">🔑 Log In</button>
                    <button class="btn btn-sm btn-secondary" id="account-register-btn">✨ Register</button>
                </div>
                <div id="account-result" class="mt-1" style="display:none;"></div>
                `}
            </div>

            <!-- ============================================================
                 LIVE CAMPAIGN (Sync)
                 ============================================================ -->
            <div class="panel settings-panel" id="sync-panel">
                <div class="panel-header">
                    <h3>🌐 Live Campaign</h3>
                    <span id="sync-status-badge" class="badge disconnected">🔴 Disconnected</span>
                </div>
                <p class="text-muted small">Connect to a campaign server for real-time collaboration with your group. Default: <strong>${v}</strong></p>
                
                <!-- User Profile Settings -->
                <div class="form-row" style="margin-bottom:0.6rem;">
                    <div class="field">
                        <label>Your Name</label>
                        <input type="text" id="sync-user-name" placeholder="Your display name" value="${o(l)}" />
                    </div>
                    <div class="field">
                        <label>Your Email <span class="text-muted small">(for Gravatar)</span></label>
                        <input type="email" id="sync-user-email" placeholder="your@email.com" value="${o(i)}" />
                    </div>
                    <div class="field" style="flex:0 0 auto;align-self:end;">
                        <button class="btn btn-sm btn-primary" id="sync-save-profile-btn">💾 Save Profile</button>
                    </div>
                </div>

                <div class="field" style="flex:0 0 120px;">
                    <label>Role</label>
                    <select id="sync-user-role" style="height: 38px;">
                        <option value="player" ${localStorage.getItem("fates-edge-client-role")==="player"?"selected":""}>👤 Player</option>
                        <option value="gm" ${localStorage.getItem("fates-edge-client-role")==="gm"?"selected":""}>🎯 GM</option>
                        <option value="spectator" ${localStorage.getItem("fates-edge-client-role")==="spectator"?"selected":""}>👁️ Spectator</option>
                    </select>
                    <p class="text-muted small" style="font-size:0.7rem;margin:0.2rem 0 0;">Co-GM isn't self-selectable here — it's granted by the room's GM after you join.</p>
                </div>
 
                <!-- Avatar Preview -->
                <div class="avatar-preview-container">
                    <img id="avatar-preview" src="${B(i,l,48)}" 
                         alt="Your avatar" />
                    <div>
                        <div class="avatar-name" id="avatar-preview-name">${l||"You"}</div>
                        <div class="avatar-email" id="avatar-preview-email">${i||"No email set"}</div>
                    </div>
                </div>
                
                <!-- Avatar Settings -->
                <div class="flex mt-1" style="margin-bottom:0.6rem;padding:0.3rem 0.6rem;background:var(--bg3);border-radius:var(--radius);flex-wrap:wrap;">
                    <label class="inline-check">
                        <input type="checkbox" id="sync-show-avatars" ${d?"checked":""} />
                        Show avatars in presence list
                    </label>
                    <label class="inline-check">
                        <input type="checkbox" id="sync-use-gravatars" ${u?"checked":""} />
                        Use Gravatar (fallback to initials)
                    </label>
                </div>
                
                <!-- Connection Settings -->
                <div class="form-row">
                    <div class="field large">
                        <label>Server URL</label>
                        <input type="text" id="sync-server-url" placeholder="${v}" value="${o(n)}" />
                    </div>
                    <div class="field">
                        <label>Campaign Code</label>
                        <input type="text" id="sync-campaign-code" placeholder="ABC123" maxlength="6" style="text-transform:uppercase;" />
                    </div>
                    <div class="field">
                        <label>Password</label>
                        <input type="password" id="sync-password" placeholder="Campaign password" />
                    </div>
                </div>
                
                <div class="flex">
                    <button class="btn btn-gold" id="sync-connect-btn">🔗 Connect</button>
                    <button class="btn btn-danger" id="sync-disconnect-btn" style="display:none;">⛔ Disconnect</button>
                    <button class="btn btn-sm btn-secondary" id="sync-refresh-btn">↻ Refresh</button>
                </div>
                
                <div id="sync-status" class="sync-status disconnected">
                    🔴 Disconnected
                </div>
                
                <div class="mt-1">
                    <h4 style="margin:0.5rem 0 0.2rem;font-size:0.95rem;">👥 Online Players</h4>
                    <div id="presence-list" class="presence-list text-muted small">
                        No other users online
                    </div>
                </div>
            </div>
            
            <!-- ============================================================
                 CAMPAIGN SHARING (HTTP)
                 ============================================================ -->
            <div class="panel settings-panel">
                <div class="panel-header">
                    <h3>📦 Campaign Sharing (HTTP)</h3>
                </div>
                <p class="text-muted small">Upload your current toolkit state to a campaign server, then share the generated code with your group. They can load it with the same code. Default: <strong>${v}</strong></p>
                <div class="form-row">
                    <div class="field large"><label>Server URL</label><input type="text" id="campaign-server-url" placeholder="${v}" value="${o(n)}" /></div>
                    <div class="field" style="flex:0 0 120px;"><label>Campaign Code</label><input type="text" id="campaign-code" placeholder="ABC123" maxlength="6" style="text-transform:uppercase;" /></div>
                </div>
                <div class="flex">
                    <button class="btn btn-gold" id="campaign-upload-btn">⬆ Upload Current State</button>
                    <button class="btn btn-primary" id="campaign-load-btn">⬇ Load State</button>
                    <button class="btn btn-danger" id="campaign-delete-btn">🗑️ Delete Campaign</button>
                </div>
                <div id="campaign-feedback" class="campaign-feedback mt-1"></div>
            </div>
            
            <!-- ============================================================
                 PREFERENCES – TOURS & ONBOARDING (NEW)
                 ============================================================ -->
            <div class="panel settings-panel settings-tours">
                <div class="panel-header">
                    <h3>🎭 Tours & Onboarding</h3>
                </div>
                <p class="text-muted small">Re‑open the introductory tours if you dismissed them earlier.</p>
                <div class="flex">
                    <button class="btn btn-sm btn-secondary" id="settings-show-welcome-tour">📜 Show Welcome Tour</button>
                    <button class="btn btn-sm btn-secondary" id="settings-show-magic-tour">🧙 Show Magic Paths Tour</button>
                </div>
                <div class="text-muted small mt-1" style="font-size:0.7rem;">
                    The Welcome Tour appears on the Home tab. The Magic Paths Tour appears in the Spellcraft tab.
                </div>
            </div>
            
            <!-- ============================================================
                 PASSWORD PROTECTION
                 ============================================================ -->
            <div class="panel settings-panel" id="password-settings-panel">
                <div class="panel-header">
                    <h3>🔐 Password Protection</h3>
                    <span id="passwordStatusBadge" class="password-status-badge ${t.passwordHash?"enabled":"disabled"}">
                        ${t.passwordHash?"🔒 Enabled":"🔓 Disabled"}
                    </span>
                </div>
                <p class="text-muted small">Require a password to access the entire toolkit. Ideal for sharing with playtesters.</p>
                <div id="passwordSettingsContent">
                    <div class="password-settings-row">
                        <div class="field"><label>Current Password <span class="text-muted small">(required to change)</span></label><input type="password" id="ps-current-pw" placeholder="Enter current password" autocomplete="current-password" /></div>
                        <div class="field"><label>New Password</label><input type="password" id="ps-new-pw" placeholder="New password (min 4 chars)" autocomplete="new-password" /></div>
                        <div class="field"><label>Confirm</label><input type="password" id="ps-confirm-pw" placeholder="Confirm new password" autocomplete="new-password" /></div>
                    </div>
                    <div class="flex">
                        <button class="btn btn-gold" id="ps-save-btn">🔑 Set / Change Password</button>
                        <button class="btn btn-danger" id="ps-remove-btn">🗝️ Remove Password</button>
                    </div>
                    <div id="passwordSettingsFeedback" class="mt-1 small" style="min-height:1.4rem;"></div>
                </div>
            </div>
            
            <!-- ============================================================
                 BASE URL
                 ============================================================ -->
            <div class="panel settings-panel">
                <div class="panel-header">
                    <h3>🌐 Document Base URL</h3>
                </div>
                <p class="text-muted small">Set the base URL used when generating shareable document links. Leave empty to auto-detect from the browser.</p>
                <div class="form-row">
                    <div class="field large"><label>Base URL</label><input type="text" id="ps-base-url" placeholder="e.g. https://yourdomain.com/fates-edge/" value="${o(t.baseUrl||"")}" /></div>
                    <div class="field" style="flex:0 0 auto;align-self:end;"><button class="btn btn-primary" id="ps-base-url-btn">💾 Save</button></div>
                </div>
                <div id="baseUrlFeedback" class="mt-1 small" style="min-height:1.2rem;"></div>
                <div class="text-muted small mt-1">Current document links will use: <span id="currentBaseUrlDisplay" style="color:var(--gold);">${W()}</span></div>
            </div>
            
            <!-- ============================================================
                 SESSION ARCHIVES
                 ============================================================ -->
            <div class="panel settings-panel">
                <div class="panel-header">
                    <h3>📦 Session Archives</h3>
                    <span class="badge">${s.length} archives</span>
                </div>
                <div id="session-archives"></div>
                <button class="btn btn-sm btn-primary mt-1" id="settings-new-session">📦 New Session (archive current)</button>
            </div>
            
            <!-- ============================================================
                 THEME & APPEARANCE
                 CHANGED: the built-in dark/light/auto buttons used to be the
                 only three that could ever exist here — now the row is
                 rendered from theme-manager's registry, so any theme a pack
                 registers (see core/theme-manager.js's doc comment, and a
                 pack's optional pack.json theme block) shows up right
                 alongside them the moment that pack is installed, no code
                 change needed here. "Auto" is still handled as a meta-option
                 (not a registered theme) exactly as before.
                 ============================================================ -->
            <div class="panel settings-panel">
                <div class="panel-header">
                    <h3>🎨 Theme & Appearance</h3>
                    <span class="badge" id="theme-count-badge">${M().length} installed</span>
                </div>
                <p class="text-muted small">Pick from any built-in theme, or a theme registered by an installed pack (see Pack Management above). "Auto" follows your system's light/dark preference.</p>
                <div class="flex" style="gap:0.5rem;flex-wrap:wrap;" id="theme-picker">
                    ${qe()}
                </div>
                <div id="theme-status-line" class="mt-1">
                    ${X()}
                </div>
            </div>
            
            <!-- ============================================================
                 LICENSE & COPYRIGHT
                 ============================================================ -->
            <div class="panel settings-panel">
                <div class="panel-header">
                    <h3>📜 License & Copyright</h3>
                </div>
                <div class="license-box">
                    <p><strong>Fate's Edge</strong> is © Nicholas A. Gasper. <strong>Used with permission, All rights reserved.</strong></p>
                    <p>The <strong>SRD</strong> and <strong>Essentials</strong> guide are licensed under CC BY-NC-SA 4.0.</p>
                    <p>All other content — setting lore, original characters, proprietary magic systems, artwork, etc. — is <strong>All Rights Reserved</strong>.</p>
                    <p><strong>Code:</strong> MIT License</p>
                    <div class="flex" style="gap:0.5rem;margin-top:0.5rem;">
                        <button class="btn btn-sm btn-secondary" id="settings-license-btn">📜 Full License</button>
                        <button class="btn btn-sm btn-secondary" id="settings-license-summary-btn">📋 Summary</button>
                    </div>
                </div>
            </div>
            
            <!-- ============================================================
                 ABOUT (UPDATED)
                 ============================================================ -->
            <div class="panel settings-panel">
                <div class="panel-header">
                    <h3>ℹ️ About Fate's Edge</h3>
                </div>
                <div style="display:flex; gap:1rem; align-items:flex-start; margin-bottom:1rem;">
                    <span style="font-size:2.5rem;">🐉</span>
                    <div>
                        <p style="margin:0 0 0.5rem; color:var(--text);">
                            <strong>Fate's Edge</strong> is an open-source, narrative-first Virtual Tabletop. 
                            It runs entirely in your browser; all data stays local.
                        </p>
                        <p style="margin:0; color:var(--text2); font-size:0.9rem;">
                            <strong>Toolkit v4.0</strong> — Modular Edition · WebSocket & Voice Support
                        </p>
                    </div>
                </div>
                <hr style="border-color:var(--border); margin:1rem 0;" />
                <div>
                    <h4 style="margin:0 0 0.5rem; color:var(--gold);">
                        🛠️ Creator: Nicholas A. Gasper 
                        <span style="font-weight:400; color:var(--text2);">(Chronophage)</span>
                    </h4>
                    <p style="margin:0 0 0.5rem; color:var(--text); font-size:0.95rem;">
                        I've been rolling dice since I was twelve — over three decades of tabletop stories.
                        I live in the Twin Cities, Minnesota, and I'm a friendly, if slightly shy, 
                        sysadmin/DevOps consultant with 20+ years in FreeBSD / Linux.
                    </p>
                    <p style="margin:0 0 0.8rem; color:var(--text); font-size:0.95rem;">
                        I designed <em>Fate's Edge</em> and built this Virtual Tabletop as my first large 
                        software project — an open‑source companion that puts the narrative first.
                    </p>
                    <blockquote style="margin:0.8rem 0; padding:0.8rem 1rem; background:rgba(201,168,76,0.05); border-left:3px solid var(--gold); border-radius:4px; font-style:italic; color:var(--text2); font-size:0.9rem;">
                        <p style="margin:0;">
                            “Keep It Stupid — minimal but not fragile. Work from user needs, 
                            set a feature limit, build in layers. I'm not a developer by trade, 
                            but that pattern has served me for decades.”
                        </p>
                    </blockquote>
                    <p style="margin:0.5rem 0 0; color:var(--text3); font-size:0.85rem;">
                        ☕ Fueled by coffee · 🧠 Neurodivergent & proud · 🌱 Community grows from within and without
                    </p>
                </div>
            </div>
            <!-- END ABOUT SECTION -->
        </div>
    `,D(),Q(),setTimeout(Y,100);try{me()}catch{}}async function xe(){const e=document.getElementById("pack-file-input"),t=document.getElementById("pack-install-feedback"),s=document.getElementById("pack-install-btn");if(!e||!e.files||e.files.length===0){t.innerHTML='<span style="color:var(--red);">❌ Please select a .zip pack file.</span>',r("Please select a pack file","error");return}const a=e.files[0];if(!a.name.endsWith(".zip")){t.innerHTML='<span style="color:var(--red);">❌ File must be a .zip archive.</span>',r("Invalid pack format","error");return}t.innerHTML='<span style="color:var(--gold);">⏳ Installing pack...</span>',s.disabled=!0;try{const n=await ce(a);t.innerHTML=`
            <span style="color:var(--green);">✅ Pack "${n.name}" v${n.version} installed successfully!</span>
            <span class="text-muted small"> ${n.modules?.length||0} modules, ${n.documents?.length||0} documents</span>
        `,r(`Pack "${n.name}" installed!`,"success"),e.value="",g(p)}catch(n){t.innerHTML=`<span style="color:var(--red);">❌ ${n.message}</span>`,r("Install failed: "+n.message,"error")}finally{s.disabled=!1}}function Ie(e){if(e)try{oe(e),setTimeout(()=>g(p),500),r("Pack uninstalled","success")}catch(t){r("Uninstall failed: "+t.message,"error")}}function Se(){g(p),r("Pack list refreshed","info")}function Y(){function e(t){const s=document.getElementById("sync-status"),a=document.getElementById("sync-status-badge"),n=document.getElementById("sync-connect-btn"),i=document.getElementById("sync-disconnect-btn"),l=document.getElementById("presence-list"),d=document.getElementById("sync-show-avatars")?.checked!==!1;if(!(!s||!n||!i))if(t&&t.isConnected){if(s.innerHTML=`🟢 Connected to ${t.campaignCode||"campaign"}`,s.className="sync-status connected",a&&(a.textContent="🟢 Connected",a.className="badge connected"),n.style.display="none",i.style.display="inline-block",l){const u=t.clients||[];u.length>0?l.innerHTML=u.filter(m=>m.id!==t.clientId).map(m=>{const y=d?B(m.email||"",m.name||"User",32):"";return`
                                <div class="presence-item">
                                    ${d?`<img src="${o(y)}" alt="${o(m.name)||"User"}" class="avatar" loading="lazy" />`:""}
                                    <span class="name">${o(m.name||"Anonymous")}</span>
                                    <span class="role">${m.role==="gm"?"🎯 GM":"👤 Player"}</span>
                                    <span class="status-dot ${m.status==="online"?"online":"away"}"></span>
                                </div>
                            `}).join("")||'<div style="color:var(--text2);padding:0.3rem 0;">Only you are connected</div>':l.innerHTML='<div style="color:var(--text2);padding:0.3rem 0;">No other users online</div>'}}else s.innerHTML="🔴 Disconnected",s.className="sync-status disconnected",a&&(a.textContent="🔴 Disconnected",a.className="badge disconnected"),n.style.display="inline-block",i.style.display="none",l&&(l.innerHTML='<div style="color:var(--text2);padding:0.3rem 0;">Not connected</div>')}f(()=>import("./sync.i5xh8ufD.js").then(t=>t.r).then(t=>{const{syncManager:s}=t;window.__syncManager=s;try{e(s.getStatus?s.getStatus():{isConnected:!1})}catch(a){console.warn("Sync getStatus not available:",a),e({isConnected:!1})}s.on&&(s.on("connection_change",e),s.on("presence_update",e)),console.log("✅ Sync module loaded successfully")}),__vite__mapDeps([0,1,2,3,4])).catch(t=>{console.warn("⚠️ Sync module not available:",t.message);const s=document.getElementById("sync-status"),a=document.getElementById("sync-status-badge");s&&(s.innerHTML="⚠️ Sync module unavailable",s.className="sync-status error"),a&&(a.textContent="⚠️ Unavailable",a.className="badge error")})}function Le(e){let t=(e||"").trim();return t?(t.startsWith("ws://")?t="http://"+t.slice(5):t.startsWith("wss://")?t="https://"+t.slice(6):!t.startsWith("http://")&&!t.startsWith("https://")&&(t=(typeof window<"u"&&window.location.protocol==="https:"?"https://":"http://")+t),t.replace(/\/+$/,"")):""}async function J(e){const t=document.getElementById("sync-server-url")?.value.trim()||v,s=document.getElementById("account-username")?.value.trim(),a=document.getElementById("account-password")?.value,n=document.getElementById("account-result");if(!s||!a){r("Enter a username and password","error");return}const i=Le(t),l=e==="register"?"/api/auth/register":"/api/auth/login";try{const d=await fetch(`${i}${l}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:s,password:a})}),u=await d.json().catch(()=>({}));if(!d.ok){const m=u?.error||`Request failed (${d.status})`;n&&(n.style.display="block",n.innerHTML=`<span style="color:var(--red);">❌ ${o(m)}</span>`),r(m,"error");return}localStorage.setItem("fates-edge-auth-token",u.token),localStorage.setItem("fates-edge-auth-username",u.user?.username||s);try{const{syncManager:m}=await f(async()=>{const{syncManager:y}=await import("./sync.i5xh8ufD.js").then(w=>w.r);return{syncManager:y}},__vite__mapDeps([0,1,2,3,4]));m.authToken=u.token}catch{}r(e==="register"?"Account created and logged in!":"Logged in!","success"),g(p)}catch(d){const u=`Could not reach ${i}: ${d.message}`;n&&(n.style.display="block",n.innerHTML=`<span style="color:var(--red);">❌ ${o(u)}</span>`),r(u,"error")}}function $e(){J("login")}function Ce(){J("register")}async function Be(){localStorage.removeItem("fates-edge-auth-token"),localStorage.removeItem("fates-edge-auth-username");try{const{syncManager:e}=await f(async()=>{const{syncManager:t}=await import("./sync.i5xh8ufD.js").then(s=>s.r);return{syncManager:t}},__vite__mapDeps([0,1,2,3,4]));e.authToken=""}catch{}r("Logged out","info"),g(p)}async function Te(){const e=document.getElementById("sync-server-url")?.value.trim()||v,t=document.getElementById("sync-campaign-code")?.value.trim().toUpperCase(),s=document.getElementById("sync-password")?.value.trim(),a=document.getElementById("sync-user-name")?.value.trim()||"Player",n=document.getElementById("sync-user-email")?.value.trim()||"",i=document.getElementById("sync-user-role")?.value||"player";if(!e||!t){r("Please enter server URL and campaign code","error");return}const l=document.getElementById("sync-status");l&&(l.innerHTML="🔄 Connecting...",l.className="sync-status connecting");try{const{syncManager:d}=await f(async()=>{const{syncManager:u}=await import("./sync.i5xh8ufD.js").then(m=>m.r);return{syncManager:u}},__vite__mapDeps([0,1,2,3,4]));d.lastPassword=s,localStorage.setItem("fates-edge-client-role",i),await d.connect(e,t,s,{name:a,email:n,role:i,authToken:localStorage.getItem("fates-edge-auth-token")||""}),r("Connected to campaign!","success")}catch(d){l&&(l.innerHTML=`❌ ${d.message}`,l.className="sync-status disconnected"),r(`Connection failed: ${d.message}`,"error")}}async function Ae(){try{const{syncManager:e}=await f(async()=>{const{syncManager:t}=await import("./sync.i5xh8ufD.js").then(s=>s.r);return{syncManager:t}},__vite__mapDeps([0,1,2,3,4]));e.disconnect(),r("Disconnected from campaign","info")}catch(e){r(`Disconnect failed: ${e.message}`,"error")}}function A(){const e=document.getElementById("sync-user-name").value.trim(),t=document.getElementById("sync-user-email").value.trim();e&&localStorage.setItem("fates-edge-client-name",e),t&&localStorage.setItem("fates-edge-user-email",t);const s=document.getElementById("avatar-preview"),a=document.getElementById("avatar-preview-name"),n=document.getElementById("avatar-preview-email"),i=document.getElementById("sync-use-gravatars")?.checked!==!1;s&&(s.src=B(i?t:"",e||"You",48)),a&&(a.textContent=e||"You"),n&&(n.textContent=t||"No email set"),f(()=>import("./sync.i5xh8ufD.js").then(l=>l.r).then(l=>{const{syncManager:d}=l;d.isConnected&&d.setName&&(d.setName(e||"Player"),d.send&&d.send({type:"presence",action:"update",clientId:d.clientId,name:e||"Player",email:t}))}),__vite__mapDeps([0,1,2,3,4])).catch(()=>{}),r("Profile saved!","success")}function Pe(){const e=document.getElementById("sync-show-avatars").checked;localStorage.setItem("fates-edge-show-avatars",String(e)),Y()}function Re(){const e=document.getElementById("sync-use-gravatars").checked;localStorage.setItem("fates-edge-use-gravatars",String(e));const t=document.getElementById("sync-user-email").value.trim(),s=document.getElementById("sync-user-name").value.trim(),a=document.getElementById("avatar-preview");a&&(a.src=B(e?t:"",s||"You",48))}function K(){return{wsUrl:document.getElementById("settings-ws-url")?.value||x,wsRoom:document.getElementById("settings-ws-room")?.value||N,wsEnabled:document.getElementById("settings-ws-enabled")?.checked!==!1,wsReconnect:document.getElementById("settings-ws-reconnect")?.checked!==!1,wsReconnectInterval:parseInt(document.getElementById("settings-ws-interval")?.value||"3000",10)}}async function Ne(){const e=document.getElementById("settings-ws-url")?.value||x,t=document.getElementById("settings-ws-result");if(!e){r("Please enter a WebSocket URL","error");return}t&&(t.style.display="block",t.innerHTML='<div class="text-muted">⏳ Testing connection...</div>');const s=await ne(e);t&&(s.success?(t.innerHTML=`
                <div style="color:var(--green);padding:0.5rem;background:var(--bg3);border-radius:4px;">
                    ✅ Connection successful! Server is reachable.
                </div>
            `,r("Connection test successful!","success")):(t.innerHTML=`
                <div style="color:var(--red);padding:0.5rem;background:var(--bg3);border-radius:4px;">
                    ❌ Connection failed: ${s.error||"Unknown error"}
                </div>
            `,r("Connection test failed","error")))}function Me(){const e=K(),t=b();if(t.settings={...t.settings,...e},I(t),localStorage.setItem("fates-edge-ws-url",e.wsUrl),localStorage.setItem("fates-edge-ws-room",e.wsRoom),localStorage.setItem("fates-edge-ws-enabled",String(e.wsEnabled)),!e.wsEnabled){r("WebSocket is disabled in settings","warning");return}if(!e.wsUrl){r("Please enter a WebSocket URL","error");return}G(e.wsRoom),L(),r("Connecting to WebSocket...","info")}function De(){P(),L(),r("WebSocket disconnected","info")}function L(){const e=document.getElementById("settings-ws-status");if(!e)return;const t=$?$():!1;e.textContent=t?"🟢 Connected":"🔴 Disconnected",e.className=`status-badge ${t?"connected":"disconnected"}`;const s=document.getElementById("settings-ws-connect"),a=document.getElementById("settings-ws-disconnect");s&&a&&(s.style.display=t?"none":"inline-block",a.style.display=t?"inline-block":"none")}function z(){const e=K(),t=b();t.settings={...t.settings,...e},I(t),localStorage.setItem("fates-edge-ws-url",e.wsUrl),localStorage.setItem("fates-edge-ws-room",e.wsRoom),localStorage.setItem("fates-edge-ws-enabled",String(e.wsEnabled)),localStorage.setItem("fates-edge-ws-reconnect",String(e.wsReconnect)),localStorage.setItem("fates-edge-ws-interval",String(e.wsReconnectInterval)),e.wsEnabled?(P(),G(e.wsRoom)):P(),L(),r("WebSocket settings saved!","success")}function Q(){document.getElementById("pack-install-btn")?.addEventListener("click",xe),document.getElementById("pack-refresh-btn")?.addEventListener("click",Se),document.getElementById("adventure-library-browse-btn")?.addEventListener("click",()=>{ye()}),document.querySelectorAll(".adventure-install-btn").forEach(e=>{e.addEventListener("click",()=>we(e.dataset.id,e))}),document.getElementById("pack-file-input")?.addEventListener("change",e=>{const t=document.getElementById("pack-install-feedback");if(e.target.files&&e.target.files.length>0){const s=e.target.files[0];t.innerHTML=`<span class="text-muted">📎 Selected: ${s.name} (${(s.size/1024).toFixed(1)} KB)</span>`}}),document.getElementById("pack-list")?.addEventListener("click",e=>{const t=e.target.closest(".uninstall-pack-btn");t&&Ie(t.dataset.id)}),document.getElementById("settings-export-btn")?.addEventListener("click",Ue),document.getElementById("settings-import-btn")?.addEventListener("click",()=>{document.getElementById("settings-import-file")?.click()}),document.getElementById("settings-import-file")?.addEventListener("change",He),document.getElementById("settings-clear-btn")?.addEventListener("click",_e),document.getElementById("ps-save-btn")?.addEventListener("click",Oe),document.getElementById("ps-remove-btn")?.addEventListener("click",ze),document.getElementById("ps-base-url-btn")?.addEventListener("click",We),document.getElementById("campaign-upload-btn")?.addEventListener("click",Fe),document.getElementById("campaign-load-btn")?.addEventListener("click",je),document.getElementById("campaign-delete-btn")?.addEventListener("click",Ge),document.getElementById("account-login-btn")?.addEventListener("click",$e),document.getElementById("account-register-btn")?.addEventListener("click",Ce),document.getElementById("account-logout-btn")?.addEventListener("click",Be),document.getElementById("sync-connect-btn")?.addEventListener("click",Te),document.getElementById("sync-disconnect-btn")?.addEventListener("click",Ae),document.getElementById("sync-refresh-btn")?.addEventListener("click",()=>{f(()=>import("./sync.i5xh8ufD.js").then(e=>e.r).then(e=>{e.syncManager&&e.syncManager.requestFullSync&&(e.syncManager.requestFullSync(),r("Refreshing sync...","info"))}),__vite__mapDeps([0,1,2,3,4])).catch(()=>{r("Sync module not available","warning")})}),document.getElementById("sync-save-profile-btn")?.addEventListener("click",A),document.getElementById("sync-show-avatars")?.addEventListener("change",Pe),document.getElementById("sync-use-gravatars")?.addEventListener("change",Re),document.getElementById("sync-user-name")?.addEventListener("keydown",e=>{e.key==="Enter"&&A()}),document.getElementById("sync-user-email")?.addEventListener("keydown",e=>{e.key==="Enter"&&A()}),document.getElementById("settings-new-session")?.addEventListener("click",Ve),document.querySelectorAll(".theme-btn").forEach(e=>{e.addEventListener("click",()=>Je(e.dataset.theme))}),O||(O=!0,document.addEventListener("theme-changed",Z)),document.getElementById("settings-license-btn")?.addEventListener("click",Ke),document.getElementById("settings-license-summary-btn")?.addEventListener("click",Qe),document.getElementById("settings-ws-test")?.addEventListener("click",Ne),document.getElementById("settings-ws-connect")?.addEventListener("click",Me),document.getElementById("settings-ws-disconnect")?.addEventListener("click",De),["settings-ws-url","settings-ws-room","settings-ws-enabled","settings-ws-reconnect","settings-ws-interval"].forEach(e=>{const t=document.getElementById(e);t&&(t.addEventListener("change",z),t.type!=="checkbox"&&t.type!=="number"&&t.addEventListener("blur",z))}),document.getElementById("settings-show-welcome-tour")?.addEventListener("click",()=>{const e=b();e.app||(e.app={}),e.app.welcomeSeen=!1,I(),window.location.hash="home",setTimeout(()=>{const t=document.querySelector("#tab-home");t&&f(()=>import("./home.7wBj1mJ4.js").then(s=>{s.render&&s.render(t)}),__vite__mapDeps([5,3,2,1,4,6])).catch(()=>{window.location.reload()})},200),r("Welcome Tour re‑enabled – go to the Home tab.","success")}),document.getElementById("settings-show-magic-tour")?.addEventListener("click",()=>{const e=b();e.app||(e.app={}),e.app.magicTourSeen=!1,I(),window.location.hash="spellcraft",setTimeout(()=>{const t=document.querySelector("#tab-spellcraft");t&&f(()=>import("./spellcraft.BTrFBpcK.js").then(s=>{s.render&&s.render(t)}),__vite__mapDeps([7,3,2,1,4,6,8,9,10,11])).catch(()=>{window.location.reload()})},200),r("Magic Paths Tour re‑enabled – go to the Spellcraft tab.","success")}),setTimeout(L,200)}function Ue(){const e=b(),t=new Blob([JSON.stringify(e,null,2)],{type:"application/json"}),s=document.createElement("a");s.href=URL.createObjectURL(t),s.download=`fates-edge-backup-${new Date().toISOString().slice(0,10)}.json`,s.click(),URL.revokeObjectURL(s.href),r("Data exported.","success")}function He(e){const t=e.target.files[0];if(!t)return;const s=new FileReader;s.onload=function(a){try{const n=JSON.parse(a.target.result);if(!n||typeof n!="object")throw new Error("Invalid data file.");j(n),r("Data imported successfully!","success"),g(p)}catch(n){r("Error importing: "+n.message,"error")}},s.readAsText(t),e.target.value=""}function _e(){confirm("Delete ALL data? This cannot be undone.")&&(te(),r("All data cleared.","success"),g(p))}async function Oe(){const e=document.getElementById("ps-current-pw").value.trim(),t=document.getElementById("ps-new-pw").value.trim(),s=document.getElementById("ps-confirm-pw").value.trim(),a=document.getElementById("passwordSettingsFeedback"),n=b();if(a.textContent="",a.style.color="",n.passwordHash){if(!e){a.textContent="❌ Current password is required to change it.",a.style.color="var(--red)";return}if(await R(e)!==n.passwordHash){a.textContent="❌ Current password is incorrect.",a.style.color="var(--red)";return}}if(!t){a.textContent="❌ New password cannot be empty.",a.style.color="var(--red)";return}if(t.length<4){a.textContent="❌ Password must be at least 4 characters.",a.style.color="var(--red)";return}if(t!==s){a.textContent="❌ Passwords do not match.",a.style.color="var(--red)";return}try{const i=await R(t);F(i),a.textContent="✅ Password updated successfully!",a.style.color="var(--green)",document.getElementById("ps-current-pw").value="",document.getElementById("ps-new-pw").value="",document.getElementById("ps-confirm-pw").value="",r("Password updated.","success"),g(p)}catch{a.textContent="⚠️ Error hashing password.",a.style.color="var(--red)"}}async function ze(){if(!confirm("Remove password protection? Anyone will be able to access the toolkit."))return;const e=b();if(!e.passwordHash){r("No password is set.","info");return}const t=document.getElementById("ps-current-pw").value.trim();if(!t){r("Please enter your current password to remove it.","error");return}try{if(await R(t)!==e.passwordHash){r("Current password incorrect.","error");return}F(null),document.getElementById("ps-current-pw").value="",r("Password removed.","success"),g(p)}catch(s){r("Error: "+s.message,"error")}}function We(){const e=document.getElementById("ps-base-url"),t=document.getElementById("baseUrlFeedback");let s=e.value.trim();s&&!s.endsWith("/")&&(s+="/"),ee(s),t.textContent="✅ Base URL saved.",t.style.color="var(--green)",document.getElementById("currentBaseUrlDisplay").textContent=W(),r("Base URL updated.","success")}async function Fe(){const e=document.getElementById("campaign-server-url").value.trim()||v,t=document.getElementById("campaign-feedback"),s=document.getElementById("campaign-upload-btn");s.disabled=!0,t.textContent="Uploading…",t.className="campaign-feedback mt-1";try{const a=b(),n=await fetch(`${e}/campaigns`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(a)});if(!n.ok){const l=await n.json();throw new Error(l.error||"Server error")}const i=await n.json();document.getElementById("campaign-code").value=i.code,t.innerHTML=`✅ Uploaded! Share code: <strong>${i.code}</strong>`,t.className="campaign-feedback mt-1 success",r(`Campaign uploaded with code ${i.code}`,"success")}catch(a){t.textContent="❌ "+a.message,t.className="campaign-feedback mt-1 error",r("Upload failed: "+a.message,"error")}finally{s.disabled=!1}}async function je(){const e=document.getElementById("campaign-server-url").value.trim()||v,t=document.getElementById("campaign-code").value.trim().toUpperCase(),s=document.getElementById("campaign-feedback"),a=document.getElementById("campaign-load-btn");if(!t){s.textContent="❌ Please enter a campaign code.",s.className="campaign-feedback mt-1 error";return}a.disabled=!0,s.textContent="Loading…",s.className="campaign-feedback mt-1";try{const n=await fetch(`${e}/campaigns/${t}`);if(!n.ok){if(n.status===404)throw new Error("Campaign not found");const l=await n.json();throw new Error(l.error||"Server error")}const i=await n.json();j(i),s.innerHTML=`✅ Loaded campaign <strong>${t}</strong> successfully!`,s.className="campaign-feedback mt-1 success",r("Campaign loaded!","success")}catch(n){s.textContent="❌ "+n.message,s.className="campaign-feedback mt-1 error",r("Load failed: "+n.message,"error")}finally{a.disabled=!1}}async function Ge(){const e=document.getElementById("campaign-server-url").value.trim()||v,t=document.getElementById("campaign-code").value.trim().toUpperCase(),s=document.getElementById("campaign-feedback"),a=document.getElementById("campaign-delete-btn");if(!t){s.textContent="❌ Please enter a campaign code to delete.",s.className="campaign-feedback mt-1 error";return}if(confirm(`Delete campaign ${t} from the server?`)){a.disabled=!0,s.textContent="Deleting…",s.className="campaign-feedback mt-1";try{const n=await fetch(`${e}/campaigns/${t}`,{method:"DELETE"});if(!n.ok){if(n.status===404)throw new Error("Campaign not found");const i=await n.json();throw new Error(i.error||"Server error")}s.innerHTML=`✅ Campaign <strong>${t}</strong> deleted.`,s.className="campaign-feedback mt-1 success",document.getElementById("campaign-code").value="",r("Campaign deleted.","success")}catch(n){s.textContent="❌ "+n.message,s.className="campaign-feedback mt-1 error",r("Delete failed: "+n.message,"error")}finally{a.disabled=!1}}}function D(){const e=document.getElementById("session-archives");if(!e)return;const t=S();if(t.length===0){e.innerHTML='<span class="text-muted">No archived sessions.</span>';return}e.innerHTML=t.slice().reverse().map(s=>`
        <div class="session-archive-item">
            <div class="archive-info">
                <span class="name">${o(s.label||"Unnamed")}</span>
                <span class="meta">${new Date(s.timestamp).toLocaleString()} · ${s.rollHistory?.length||0} rolls</span>
            </div>
            <div class="flex" style="gap:0.3rem;">
                <button class="btn btn-xs btn-primary view-archive-btn" data-id="${s.id}">👁️</button>
                <button class="btn btn-xs btn-danger delete-archive-btn" data-id="${s.id}">🗑️</button>
            </div>
        </div>
    `).join(""),e.querySelectorAll(".view-archive-btn").forEach(s=>{s.addEventListener("click",()=>{const a=parseInt(s.dataset.id),n=S().find(i=>i.id===a);n&&r(`Viewing archive: ${n.label}`,"info")})}),e.querySelectorAll(".delete-archive-btn").forEach(s=>{s.addEventListener("click",()=>{confirm("Delete this archive?")&&(ae(parseInt(s.dataset.id)),D(),r("Archive deleted.","success"))})})}function Ve(){const e=b();if(e.rollHistory.length===0&&e.chatHistory.length===0){r("No data to archive.","info");return}const t=prompt("Session label:",`Session ${S().length+1}`)||`Session ${S().length+1}`,s={id:Date.now(),timestamp:Date.now(),rollHistory:[...e.rollHistory],chatHistory:[...e.chatHistory],label:t};se(s),e.rollHistory=[],e.chatHistory=[],I(),D(),r("New session started; previous archived.","success")}function qe(){const e=q(),t=M().map(s=>`<button class="btn btn-sm theme-btn${e===s.id?" active":""}" data-theme="${s.id}">${s.icon||"🎨"} ${o(s.label)}</button>`);return t.push(`<button class="btn btn-sm theme-btn${e==="auto"?" active":""}" data-theme="auto">🔄 Auto</button>`),t.join("")}function Ye(e){if(e==="dark"||e==="light")return{label:"Built-in",pack:null};const t=V().find(s=>s.theme&&s.theme.id===e);return t?{label:"From Pack",pack:t}:{label:"Registered",pack:null}}function X(){const e=q()==="auto",t=ue(),s=ie(t),a=Ye(t);return`
        <span class="theme-status-badge">
            <span class="dot"></span>
            Active: <strong>${s?`${s.icon||"🎨"} ${o(s.label)}`:o(t)}</strong>${e?` <span class="text-muted small">(Auto — matches your system's ${t==="dark"?"dark":"light"} preference)</span>`:""}
            ${a.pack?`<span class="source-tag" title="Registered by this pack">${o(a.pack.name)} v${o(a.pack.version)}</span>`:`<span class="source-tag">${o(a.label)}</span>`}
        </span>
    `}function Z(){const e=document.getElementById("theme-count-badge");e&&(e.textContent=`${M().length} installed`);const t=document.getElementById("theme-status-line");t&&(t.innerHTML=X())}function Je(e){ge(e),document.querySelectorAll(".theme-btn").forEach(t=>{t.classList.toggle("active",t.dataset.theme===e)}),Z()}function Ke(){const e=document.getElementById("licenseModal");if(!e)return;const t=document.getElementById("licenseContent");t&&(t.innerHTML=`
            <div style="font-family:var(--font-mono);white-space:pre-wrap;font-size:0.85rem;line-height:1.6;color:var(--text2);">
                ${ke}
            </div>
        `),e.classList.add("open")}function Qe(){const e=document.getElementById("licenseModal");if(!e)return;const t=document.getElementById("licenseContent");t&&(t.innerHTML=`
            <div style="font-family:var(--font-mono);white-space:pre-wrap;font-size:0.9rem;line-height:1.8;color:var(--text2);">
                ${Ee}
            </div>
        `),e.classList.add("open")}setInterval(()=>{const e=document.getElementById("sync-status");if(e&&window.__syncManager)try{const t=window.__syncManager.getStatus?window.__syncManager.getStatus():null;t&&t.isConnected&&(e.innerHTML=`🟢 Connected to ${t.campaignCode||"campaign"}`)}catch{}L()},1e4);var rt={render:g,attachEvents:Q};export{Q as attachEvents,rt as default,Ue as exportAllData,He as importAllData,g as render};
