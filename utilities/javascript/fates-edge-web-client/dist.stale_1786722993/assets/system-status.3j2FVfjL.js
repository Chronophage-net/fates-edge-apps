const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/voice.D0Q3-VlJ.js","assets/rolldown-runtime.BQ-_32WO.js","assets/state.42sFgcOQ.js","assets/utils.lBShoim5.js","assets/Toast.DDAtBIAw.js","assets/websocket.Dmklt06W.js","assets/preload-helper.BATLnrmA.js","assets/main.hiOZSyFC.js","assets/sync.i5xh8ufD.js","assets/main.DcCFXHiG.css","assets/turn.BEaIH0Xk.js"])))=>i.map(i=>d[i]);
import{t as b}from"./sync.i5xh8ufD.js";import{t as S}from"./preload-helper.BATLnrmA.js";import{c as $,d as y,f as C,p as f,s as w,u as R}from"./websocket.Dmklt06W.js";import{_ as x}from"./main.hiOZSyFC.js";import{getSearchStatus as D}from"./search.DomaAvmg.js";import{t as M}from"./turn.BEaIH0Xk.js";var m=5e3,u=null,k=[/\bbot\b/i,/^ai[_-]?gm$/i,/\baigm\b/i,/discord/i];function N(e){return e?k.some(t=>t.test(e)):!1}function c(e,t){return`<span class="status-dot ${e===!0?"online":e===!1?"offline":"connecting"}" title="${t}"></span>`}function s(e,t="blue"){return`<span class="badge badge-${t}">${e}</span>`}function l(e,t){return`<div class="status-row"><span>${e}</span>${s(t?"Available":"Not available",t?"green":"red")}</div>`}async function T(){return{connected:f(),mode:$(),wsStatus:C(),room:R(),socketId:y()}}async function I(){let e=null;try{e=await S(()=>import("./voice.D0Q3-VlJ.js").then(n=>n.l),__vite__mapDeps([0,1,2,3,4,5,6,7,8,9,10]))}catch(n){return{available:!1,error:n.message}}const t=e.isVoiceInitialized?e.isVoiceInitialized():!1,i=e.getVoiceStatus?e.getVoiceStatus():{enabled:!1,muted:!1},r=e.getActiveVoiceClients?e.getActiveVoiceClients():[];let a=null;try{a=(await M()).length>0}catch{a=!1}return{available:!0,initialized:t,status:i,peerCount:r.length,turnConfigured:a}}function _(){try{return x()}catch{return{isRecording:!1,duration:0}}}function A(){try{const e=b();return e.getConnectionStatus?e.getConnectionStatus():null}catch{return null}}async function E(){if(!f())return[];try{const e=await w();return Array.isArray(e)?e:[]}catch{return[]}}function V(){try{return D()}catch(e){return{isInitialized:!1,backend:null,indexCount:0,solrConfigured:!1,elasticsearchConfigured:!1,error:e.message}}}function B(){return{webrtc:typeof RTCPeerConnection<"u",getUserMedia:!!(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia),displayMedia:!!(navigator.mediaDevices&&navigator.mediaDevices.getDisplayMedia),indexedDB:typeof indexedDB<"u",notifications:typeof Notification<"u"}}function L(e){const t=Math.max(0,Math.floor(e||0)),i=Math.floor(t/60),r=t%60;return`${String(i).padStart(2,"0")}:${String(r).padStart(2,"0")}`}async function v(){const[e,t,i]=await Promise.all([T(),I(),E()]),r=_(),a=A(),n=V(),o=B(),h=i.length?i.map(d=>`
            <div class="status-row">
                <span>${d.name||"Unknown"}${N(d.name)?" "+s("🤖 possible bot","purple"):""}</span>
                ${s(d.role||"player",d.role==="gm"?"gold":"blue")}
            </div>
        `).join(""):`<p class="text-muted small">${e.connected?"No other clients connected.":"Not connected to a server."}</p>`;return`
        <div class="panel">
            <div style="display:flex;align-items:center;justify-content:space-between;">
                <h3>🩺 System Status</h3>
                <button class="btn btn-sm" id="system-status-refresh">🔄 Refresh</button>
            </div>
            <p class="text-muted small">Auto-refreshes every ${m/1e3}s while this page is open.</p>

            <div class="grid-2" style="margin-top:1rem;">
                <div class="panel">
                    <h4>${c(e.connected,e.connected?"Connected":"Disconnected")} Real-Time Server</h4>
                    <div class="status-row"><span>Status</span>${s(e.connected?"Connected":"Disconnected",e.connected?"green":"red")}</div>
                    <div class="status-row"><span>Transport</span>${s(e.mode,"blue")}</div>
                    <div class="status-row"><span>Room</span>${s(e.room||"—","blue")}</div>
                    <div class="status-row"><span>Client ID</span><span class="text-muted small">${e.socketId||"—"}</span></div>
                </div>

                <div class="panel">
                    <h4>${c(t.available&&t.status?.enabled,"Voice chat")} Voice Chat</h4>
                    ${t.available?`
                        <div class="status-row"><span>Enabled</span>${s(t.status.enabled?"Yes":"No",t.status.enabled?"green":"red")}</div>
                        <div class="status-row"><span>Muted</span>${s(t.status.muted?"Yes":"No",t.status.muted?"gold":"green")}</div>
                        <div class="status-row"><span>Connected peers</span>${s(String(t.peerCount),"blue")}</div>
                        <div class="status-row"><span>TURN (NAT traversal)</span>${t.turnConfigured===null?s("Unknown","blue"):s(t.turnConfigured?"Available":"STUN-only",t.turnConfigured?"green":"gold")}</div>
                    `:`<p class="text-muted small">Voice module unavailable: ${t.error||"unknown error"}</p>`}
                </div>

                <div class="panel">
                    <h4>${c(r.isRecording,"Recording")} Session Recording</h4>
                    <div class="status-row"><span>Status</span>${s(r.isRecording?"🔴 Recording":"Idle",r.isRecording?"red":"blue")}</div>
                    ${r.isRecording?`<div class="status-row"><span>Duration</span><span class="text-muted small">${L(r.duration)}</span></div>`:""}
                </div>

                <div class="panel">
                    <h4>${c(!!a?.isConnected,"Sync layer")} Sync / Offline Queue</h4>
                    ${a?`
                        <div class="status-row"><span>Status</span>${s(a.isConnected?"Connected":a.isConnecting?"Connecting…":"Disconnected",a.isConnected?"green":a.isConnecting?"gold":"red")}</div>
                        <div class="status-row"><span>Queued (offline) ops</span>${s(String(a.offlineQueueSize??0),a.offlineQueueSize?"gold":"green")}</div>
                        <div class="status-row"><span>Pending acks</span>${s(String(a.pendingOperations??0),"blue")}</div>
                    `:'<p class="text-muted small">Sync manager unavailable.</p>'}
                </div>

                <div class="panel">
                    <h4>👥 Connected Clients ${e.connected?s(String(i.length),"blue"):""}</h4>
                    ${h}
                </div>

                <div class="panel">
                    <h4>${c(n.isInitialized,"Search index")} Search</h4>
                    <div class="status-row"><span>Backend</span>${s(n.backend==="solr"?"Solr":n.backend==="elasticsearch"?"Elasticsearch":n.backend==="fuse"?"Local (Fuse.js)":"Not loaded yet",n.backend==="solr"||n.backend==="elasticsearch"?"green":"blue")}</div>
                    <div class="status-row"><span>Indexed entries</span>${s(String(n.indexCount??0),"blue")}</div>
                    ${n.solrConfigured||n.elasticsearchConfigured?`
                        <div class="status-row"><span>Solr configured</span>${s(n.solrConfigured?"Yes":"No",n.solrConfigured?"green":"blue")}</div>
                        <div class="status-row"><span>Elasticsearch configured</span>${s(n.elasticsearchConfigured?"Yes":"No",n.elasticsearchConfigured?"green":"blue")}</div>
                    `:'<p class="text-muted small">No external search backend configured — using the built-in local index.</p>'}
                </div>

                <div class="panel">
                    <h4>🌐 Browser Capabilities</h4>
                    ${l("WebRTC",o.webrtc)}
                    ${l("Microphone (getUserMedia)",o.getUserMedia)}
                    ${l("Screen capture (getDisplayMedia)",o.displayMedia)}
                    ${l("Local storage (IndexedDB)",o.indexedDB)}
                    ${l("Notifications",o.notifications)}
                </div>
            </div>
        </div>
    `}function p(){u&&(clearInterval(u),u=null)}async function g(e){e.innerHTML=await v();const t=e.querySelector("#system-status-refresh");t&&t.addEventListener("click",()=>g(e)),p(),u=setInterval(async()=>{if(!e.isConnected){p();return}e.innerHTML=await v();const i=e.querySelector("#system-status-refresh");i&&i.addEventListener("click",()=>g(e))},m)}function U(){p()}function z(){p()}var q={render:g,onDeactivate:U,destroy:z};export{q as default,z as destroy,U as onDeactivate,g as render};
