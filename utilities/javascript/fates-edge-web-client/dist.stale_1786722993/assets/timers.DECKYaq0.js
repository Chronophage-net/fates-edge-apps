import{a as C,i as k,l as N}from"./utils.lBShoim5.js";import{D as $,b as h,f as H,i as j}from"./state.42sFgcOQ.js";import{n as a}from"./Toast.DDAtBIAw.js";import{p as z}from"./websocket.Dmklt06W.js";import{h as q,m as G}from"./main.hiOZSyFC.js";function _(e,{onTick:t,onReset:n,onDelete:o},i=!1){const r=document.createElement("div");r.className=i?"":"timer-widget";const c=Math.min(e.current,e.segments),d=e.segments>0?c/e.segments:0,y=d>=.75,m=d>=1,p=m?"complete":y?"danger":"";let v="";for(let g=0;g<e.segments;g++)v+=`<span class="timer-seg ${g<c?"filled":""} ${g<c&&y?"danger":g<c&&m?"complete":""}">${g<c?"●":"○"}</span>`;i?r.innerHTML=`
            <div style="margin-bottom:0.6rem;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <div><strong>${k(e.name)}</strong> <span class="text-muted">${e.current}/${e.segments}</span></div>
                    <div class="flex">
                        <button class="btn btn-xs btn-primary" data-action="tick">+</button>
                        <button class="btn btn-xs" data-action="reset">↺</button>
                    </div>
                </div>
                <div style="display:flex;gap:0.4rem;align-items:center;margin:0.2rem 0;">
                    <div class="timer-bar-wrap"><div class="timer-bar-fill ${p}" style="width:${d*100}%;"></div></div>
                    <span class="timer-label">${Math.round(d*100)}%</span>
                </div>
            </div>
        `:r.innerHTML=`
            <div style="background:var(--bg3);padding:0.8rem;border-radius:var(--radius);margin-bottom:0.6rem;border:1px solid var(--border);">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.4rem;">
                    <div><strong>${k(e.name)}</strong> <span class="text-muted">${e.current}/${e.segments}</span></div>
                    <div class="flex">
                        <button class="btn btn-sm btn-primary" data-action="tick">+ Tick</button>
                        <button class="btn btn-sm" data-action="reset">↺</button>
                        <button class="btn btn-sm btn-danger" data-action="delete">🗑️</button>
                    </div>
                </div>
                <div style="display:flex;gap:0.4rem;align-items:center;margin:0.4rem 0;">
                    <div class="timer-bar-wrap"><div class="timer-bar-fill ${p}" style="width:${d*100}%;"></div></div>
                    <span class="timer-label">${Math.round(d*100)}%</span>
                </div>
                <div class="timer-display">${v}</div>
                ${m?'<span style="font-size:0.7rem;color:var(--green);">✓ Complete</span>':""}
            </div>
        `;const s=r.querySelector('[data-action="tick"]'),L=r.querySelector('[data-action="reset"]'),B=r.querySelector('[data-action="delete"]');return s&&t&&s.addEventListener("click",t),L&&n&&L.addEventListener("click",n),B&&o&&B.addEventListener("click",o),r}var l=null,E=null;function D(){if(document.getElementById("timer-modal-styles"))return;const e=document.createElement("style");e.id="timer-modal-styles",e.textContent=`
        /* Inline editor screen — not a pop-up. */
        #timerModal {
            display: none;
        }
        #timerModal.open {
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 1rem 0;
        }
        #timerModal .modal-content {
            background: var(--bg, #1e1e2e);
            color: var(--text, #e0e0e0);
            border-radius: 12px;
            max-width: 500px;
            width: 100%;
            margin: 0 auto;
            padding: 1.5rem;
            box-shadow: 0 20px 60px rgba(0,0,0,0.35);
            border: 1px solid var(--border, #333);
        }
        #timerModal .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1rem;
        }
        #timerModal .modal-footer {
            display: flex;
            justify-content: flex-end;
            gap: 0.5rem;
            margin-top: 1rem;
            padding-top: 0.8rem;
            border-top: 1px solid var(--border, #444);
        }
        .form-row {
            display: flex;
            gap: 0.8rem;
            flex-wrap: wrap;
        }
        .form-row .field {
            flex: 1;
            min-width: 120px;
        }
        .form-row .field.small {
            flex: 0 0 100px;
        }
        .form-row label {
            display: block;
            font-weight: 600;
            font-size: 0.9rem;
            margin-bottom: 0.2rem;
        }
        .form-row input {
            width: 100%;
            padding: 0.4rem;
            background: var(--bg2, #2a2a2a);
            border: 1px solid var(--border, #444);
            border-radius: 6px;
            color: var(--text, #e0e0e0);
            font-size: 0.9rem;
        }
    `,document.head.appendChild(e)}function O(){return`
        <div class="modal-content">
            <div class="modal-header">
                <button id="timerModalClose" class="btn btn-secondary editor-back">← Back</button>
                <h3 id="timer-modal-title">Timer</h3>
            </div>
            <div id="timer-editor-content" class="modal-body"></div>
            <div class="modal-footer"></div>
        </div>
    `}var T=null;function A(){const e=document.getElementById("timerModal");e&&e.remove(),D();const t=document.createElement("div");return t.id="timerModal",t.className="editor-screen-host",t.style.display="none",t.innerHTML=O(),(document.getElementById("app-content")||document.body).appendChild(t),t}function R(){const e=document.getElementById("timerModal");if(!e){console.error("[Timers] Modal not found when trying to open");return}const t=document.getElementById("app-content")||document.body;T=Array.from(t.children).filter(n=>n!==e),T.forEach(n=>{n.style.display="none"}),e.classList.add("open"),e.style.display="flex",window.scrollTo({top:0})}function w(){const e=document.getElementById("timerModal");e&&(e.classList.remove("open"),e.style.display="none"),T&&(T.forEach(t=>{t.style.display=""}),T=null),E=null}function x(){return z()?q(G()):!0}function I(e){l=e;const t=x();l.innerHTML=`
        <div class="flex-between" style="flex-wrap:wrap;gap:0.5rem;">
            <div>
                <h1 class="page-title">⏱️ Timers</h1>
                <p class="page-sub">Track scene pressure and faction clocks.</p>
            </div>
            ${t?'<button class="btn btn-gold" id="add-timer-btn">+ New Timer</button>':""}
        </div>
        <div class="panel" id="timer-list-container">
            <div id="timer-list"></div>
        </div>
    `,b(),S()}function b(){const e=l.querySelector("#timer-list");if(!e)return;const t=h().timers||[],n=x();if(t.length===0){e.innerHTML=`
            <div class="empty-state" style="text-align:center;padding:2rem;color:var(--text3);">
                <div style="font-size:2rem;margin-bottom:0.5rem;">⏱️</div>
                <div>No timers created.</div>
                ${n?'<div style="font-size:0.8rem;margin-top:0.3rem;">Click "New Timer" to start tracking scene pressure.</div>':""}
            </div>
        `;return}let o=!1;t.forEach(i=>{i.id||(i.id=C("timer_"),o=!0)}),o&&$(),e.innerHTML="",t.forEach(i=>{const r=_(i,{onTick:()=>U(i.id),onReset:()=>F(i.id),onEdit:n?()=>M(i.id):null,onDelete:n?()=>P(i.id):null},!1);e.appendChild(r)})}function U(e){const t=h().timers.find(n=>n.id===e);t&&(t.current=Math.min(t.current+1,t.segments),$(),b(),t.current>=t.segments&&a(`⏱️ Timer "${t.name}" completed!`,"warning"))}function F(e){const t=h().timers.find(n=>n.id===e);t&&(t.current=0,$(),b(),a(`Timer "${t.name}" reset.`,"info"))}function P(e){if(!x()){a("Only the GM can delete timers.","error");return}confirm("Delete this timer?")&&(H(e),b(),a("Timer deleted.","success"))}function M(e=null){if(!x()){a("Only the GM can create or edit timers.","error");return}console.log("[Timers] openTimerEditor called with id:",e);try{const t=A();console.log("[Timers] Modal created:",t);const n=document.getElementById("timer-modal-title"),o=document.getElementById("timer-editor-content"),i=t.querySelector(".modal-footer");if(console.log("[Timers] Elements:",{title:n,content:o,footer:i}),!n||!o||!i){console.error("[Timers] Missing modal elements – aborting"),a("Could not open timer editor – missing modal parts.","error");return}E=e;const r=!!e,c=h(),d=r?c.timers.find(s=>s.id===e):null;n.textContent=r?"Edit Timer":"New Timer",o.innerHTML=`
            <div class="form-row">
                <div class="field">
                    <label>Name</label>
                    <input id="te-name" value="${k(d?.name||"")}" placeholder="Timer name" />
                </div>
                <div class="field small">
                    <label>Segments</label>
                    <input type="number" id="te-segments" value="${d?.segments||4}" min="1" max="24" />
                </div>
            </div>
            ${r?`<div style="font-size:0.85rem;color:var(--text3);margin-top:0.5rem;">Current: ${d?.current||0}/${d?.segments||4}</div>`:""}
        `,i.innerHTML=`
            <button class="btn btn-gold" id="te-save-btn">${r?"💾 Update":"➕ Create"}</button>
            <button class="btn" id="te-cancel-btn">Cancel</button>
        `,R();const y=document.getElementById("te-name");y&&setTimeout(()=>y.focus(),50);const m=document.getElementById("te-save-btn"),p=document.getElementById("te-cancel-btn"),v=document.getElementById("timerModalClose");if(m){const s=m.cloneNode(!0);m.parentNode.replaceChild(s,m),s.addEventListener("click",W)}if(p){const s=p.cloneNode(!0);p.parentNode.replaceChild(s,p),s.addEventListener("click",w)}if(v){const s=v.cloneNode(!0);v.parentNode.replaceChild(s,v),s.addEventListener("click",w)}console.log("[Timers] Editor opened successfully")}catch(t){console.error("[Timers] openTimerEditor error:",t),a("Failed to open timer editor.","error")}}function W(){if(!x()){a("Only the GM can save timer changes.","error"),w();return}try{const e=document.getElementById("te-name"),t=document.getElementById("te-segments"),n=e?.value.trim()||"Unnamed",o=Math.max(1,N(t?.value,4)),i=h().timers||[];if(E){const r=i.find(c=>c.id===E);if(r)r.name=n,r.segments=o,r.current>o&&(r.current=o),$(),a(`Timer "${n}" updated.`,"success");else{a("Timer not found.","error");return}}else j({id:C("timer_"),name:n,segments:o,current:0}),a(`Timer "${n}" created.`,"success");w(),b()}catch(e){console.error("[Timers] Save error:",e),a("Error saving timer.","error")}}var u=null,f=null;function S(){l&&(u&&(l.removeEventListener("click",u),u=null),u=e=>{e.target.closest("#add-timer-btn")&&(e.preventDefault(),console.log("[Timers] New Timer button clicked"),M())},l.addEventListener("click",u),f&&(document.removeEventListener("timer-edit",f),f=null),f=e=>{e.detail&&e.detail.id&&M(e.detail.id)},document.addEventListener("timer-edit",f))}function J(){b()}function K(){}function Q(){l&&I(l)}function V(){l&&u&&(l.removeEventListener("click",u),u=null),f&&(document.removeEventListener("timer-edit",f),f=null),l=null}var ne={render:I,onActivate:J,onDeactivate:K,refresh:Q,destroy:V,attachEvents:S,openTimerEditor:M};export{S as attachEvents,ne as default,V as destroy,J as onActivate,K as onDeactivate,M as openTimerEditor,Q as refresh,I as render};
