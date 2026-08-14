const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/crypto.nxV1MQPP.js","assets/utils.lBShoim5.js"])))=>i.map(i=>d[i]);
import{g as H,i as y,l as b}from"./utils.lBShoim5.js";import{D as z,b as x,r as _}from"./state.42sFgcOQ.js";import{t as V}from"./preload-helper.BATLnrmA.js";import{g as j,p as R,v as P,w as U}from"./websocket.Dmklt06W.js";import{r as O,t as F}from"./gm-tools.BcndmVEn.js";var m=null,I=new Map,h=null,T=!1;async function S(){if(h)return h;if(T)return null;T=!0;try{return h=await V(()=>import("./crypto.nxV1MQPP.js"),__vite__mapDeps([0,1])),console.log("[Dice] Crypto module loaded successfully"),h}catch{return console.debug("[Dice] Crypto module not available, using fallback RNG"),null}}var p=null,u=null,g=class{constructor(e){this.seed=e,this.state=this._seedToState(e)}_seedToState(e){let t=0,o=0;if(typeof e=="number")t=e,o=e+114007148193232e5;else if(typeof e=="string"){let n=0;for(let l=0;l<e.length;l++)n=(n<<5)-n+e.charCodeAt(l),n=n&n;t=n,o=n+114007148193232e5}else t=Date.now(),o=Date.now()+114007148193232e5;return{s0:BigInt(t),s1:BigInt(o)}}random(){let e=this.state.s0,t=this.state.s1,o=e;return t=t^t<<BigInt(23),t=t^t>>BigInt(17),t=t^(o^o>>BigInt(26)),this.state.s0=o,this.state.s1=t,Number(t+o&BigInt(18446744073709552e3))/18446744073709552e3}randomInt(e,t){return Math.floor(this.random()*(t-e))+e}randomIntInclusive(e,t){return Math.floor(this.random()*(t-e+1))+e}};async function G(){const e=await S();return e&&e.getSeed?e.getSeed():null}async function L(e){const t=await S();return t&&t.setSeed?t.setSeed(e):!1}async function W(){const e=await S();if(e&&e.generateSeed)return e.generateSeed();try{if(window&&window.crypto&&window.crypto.getRandomValues){const t=new Uint32Array(4);return window.crypto.getRandomValues(t),t.reduce((o,n)=>o+n.toString(16).padStart(8,"0"),"")}}catch{}return Date.now().toString(36)+Math.random().toString(36).substring(2,8)}function f(){return p}function E(e){if(p=e,e){u=new g(e);try{localStorage.setItem("fates-edge-seed",e)}catch{}L(e).catch(()=>{})}else{u=null;try{localStorage.removeItem("fates-edge-seed")}catch{}L(null).catch(()=>{})}return!0}async function M(){const e=await W();return E(e),e}try{const e=localStorage.getItem("fates-edge-seed");e&&(p=e,u=new g(e),console.log("[Dice] Seed loaded from localStorage:",e.substring(0,8)+"..."))}catch{}if(!p&&typeof window<"u"&&window.__RANDOM_SEED){p=window.__RANDOM_SEED,u=new g(p);try{localStorage.setItem("fates-edge-seed",p),console.log("[Dice] Seed loaded from window.__RANDOM_SEED:",p.substring(0,8)+"...")}catch{}}p||G().then(e=>{if(e){p=e,u=new g(e),console.log("[Dice] Seed loaded from crypto module:",e.substring(0,8)+"...");try{localStorage.setItem("fates-edge-seed",e)}catch{}}}).catch(()=>{});function k(){if(u)return u.random();try{if(typeof window<"u"&&window.crypto&&window.crypto.getRandomValues){const e=new Uint32Array(1);return window.crypto.getRandomValues(e),e[0]/4294967296}}catch{}return Math.random()}function X(e,t){return u?u.randomInt(e,t):Math.floor(k()*(t-e))+e}function q(e,t){return u?u.randomIntInclusive(e,t):Math.floor(k()*(t-e+1))+e}function C(e,t="info"){if(window.showToast){window.showToast(e,t);return}const o={info:"var(--text)",success:"var(--green)",error:"var(--red)",warning:"var(--orange)"},n=document.createElement("div");n.style.cssText=`
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: var(--bg2);
        color: ${o[t]||o.info};
        padding: 0.8rem 1.5rem;
        border-radius: var(--radius);
        border: 1px solid var(--border);
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 9999;
        font-size: 0.9rem;
        max-width: 90%;
        animation: slideUp 0.3s ease;
    `,n.textContent=e,document.body.appendChild(n),setTimeout(()=>{n.style.opacity="0",n.style.transition="opacity 0.3s ease",setTimeout(()=>{n.parentNode&&n.parentNode.removeChild(n)},300)},3e3)}function w(e){console.log("🎲 Dice.render() called"),m=e;const t=f(),o=!!t,n=R();return m.innerHTML=`
        <h1 class="page-title">🎲 Dice Roller</h1>
        <p class="page-sub">Roll dice with the Fate's Edge resolution system.</p>
        
        <!-- Connection & Seed Status -->
        <div class="panel" style="padding:0.3rem 0.8rem;margin-bottom:0.5rem;background:var(--bg3);border-left:3px solid ${n?"var(--green)":"var(--text3)"};">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.3rem;">
                <span style="font-size:0.8rem;color:var(--text2);">
                    ${n?"🟢 Connected to server":"📡 Local mode"}
                    ${o?` 🎲 Deterministic (seed: ${t.substring(0,8)}...)`:" 🔀 Cryptographic RNG"}
                </span>
                <div style="display:flex;gap:0.3rem;flex-wrap:wrap;">
                    <button class="btn btn-xs btn-ghost" id="seed-regenerate" title="Regenerate seed">🔄 New Seed</button>
                    <button class="btn btn-xs btn-ghost" id="seed-clear" title="Clear seed (use crypto)">🧹 Clear Seed</button>
                </div>
            </div>
        </div>
        
        <div class="panel">
            <div class="form-row">
                <div class="field small">
                    <label>Attribute</label>
                    <select id="roll-attr">
                        <option value="1">1</option>
                        <option value="2" selected>2</option>
                        <option value="3">3</option>
                        <option value="4">4</option>
                        <option value="5">5</option>
                    </select>
                </div>
                <div class="field small">
                    <label>Skill</label>
                    <select id="roll-skill">
                        <option value="0">0</option>
                        <option value="1" selected>1</option>
                        <option value="2">2</option>
                        <option value="3">3</option>
                        <option value="4">4</option>
                        <option value="5">5</option>
                    </select>
                </div>
                <div class="field small">
                    <label>DV</label>
                    <select id="roll-dv">
                        <option value="2">2</option>
                        <option value="3" selected>3</option>
                        <option value="4">4</option>
                        <option value="5">5</option>
                        <option value="6">6</option>
                    </select>
                </div>
                <div class="field small">
                    <label>Position</label>
                    <select id="roll-position">
                        <option value="controlled" selected>Controlled</option>
                        <option value="dominant">Dominant</option>
                        <option value="desperate">Desperate</option>
                    </select>
                </div>
                <div class="field small">
                    <label>Boons</label>
                    <select id="roll-boons">
                        <option value="0" selected>0</option>
                        <option value="1">1</option>
                        <option value="2">2</option>
                        <option value="3">3</option>
                        <option value="4">4</option>
                        <option value="5">5</option>
                    </select>
                </div>
            </div>
            
            <!-- Quick Roll Presets -->
            <div class="preset-rolls" style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-bottom:0.5rem;">
                <button class="btn btn-sm btn-ghost" data-roll-preset="combat">⚔️ Combat (3+2, DV3)</button>
                <button class="btn btn-sm btn-ghost" data-roll-preset="stealth">👤 Stealth (2+3, DV4)</button>
                <button class="btn btn-sm btn-ghost" data-roll-preset="social">💬 Social (2+2, DV3)</button>
                <button class="btn btn-sm btn-ghost" data-roll-preset="magic">🔮 Magic (1+4, DV5)</button>
                <button class="btn btn-sm btn-ghost" data-roll-preset="desperate">🔥 Desperate (2+2, DV4, Desperate)</button>
                <button class="btn btn-sm btn-ghost" data-roll-preset="deterministic">🎲 Deterministic Demo</button>
            </div>
            
            <div class="flex">
                <button class="btn btn-gold" id="roll-btn">🎲 Roll</button>
                <button class="btn btn-sm" id="roll-clear-history">🗑️ Clear History</button>
                <button class="btn btn-sm" id="roll-export-history">📤 Export</button>
            </div>
        </div>
        
        <div id="roll-result" class="panel" style="display:none;"></div>
        
        <div class="panel">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;">
                <h3 style="margin:0;">📜 Roll History</h3>
                <div id="roll-stats" style="font-size:0.8rem;color:var(--text2);"></div>
            </div>
            <div id="roll-history" style="max-height:300px;overflow-y:auto;margin-top:0.5rem;">
                <span class="text-muted">No rolls yet.</span>
            </div>
        </div>
    `,Q(),D(),B(),J(),m}function J(){if(A(),!R()){console.log("[Dice] Not connected to server, local mode only");return}const e=t=>{if(!t)return;console.log("[Dice] Received roll from server:",t);const o={...t,id:t.id||`remote_${Date.now()}`,timestamp:t.timestamp||new Date().toISOString(),remote:!0,sender:t.sender||"Remote"};_(o),D(),B(),C(`🎲 ${t.sender||"Remote"} rolled: ${t.outcome||"Dice"}`,"info")};try{P("roll-result",e),I.set("roll-result",e),console.log("[Dice] WebSocket sync enabled")}catch(t){console.warn("[Dice] Could not setup WebSocket sync:",t)}}function A(){for(const[e,t]of I)try{j(e,t)}catch(o){console.debug("[Dice] Error removing listener:",o)}I.clear()}function Q(){const e=document.getElementById("roll-btn");if(e){const s=e.cloneNode(!0);e.parentNode.replaceChild(s,e),s.addEventListener("click",K)}const t=document.getElementById("roll-clear-history");if(t){const s=t.cloneNode(!0);t.parentNode.replaceChild(s,t),s.addEventListener("click",ee)}const o=document.getElementById("roll-export-history");if(o){const s=o.cloneNode(!0);o.parentNode.replaceChild(s,o),s.addEventListener("click",te)}document.querySelectorAll("[data-roll-preset]").forEach(s=>{const a=s.cloneNode(!0);s.parentNode.replaceChild(a,s),a.addEventListener("click",function(){const c=this.dataset.rollPreset;Y(c)})});const n=document.getElementById("seed-regenerate");n&&n.addEventListener("click",async function(){const s=await M();w(m),C("🎲 New seed generated: "+s.substring(0,8)+"...","success")});const l=document.getElementById("seed-clear");l&&l.addEventListener("click",function(){confirm("Clear the deterministic seed? This will use cryptographic RNG instead.")&&(E(null),w(m),C("🧹 Seed cleared. Using cryptographic RNG.","info"))}),document.addEventListener("keydown",s=>{if(s.key==="Enter"&&m&&m.contains(s.target)){const a=document.getElementById("roll-btn");a&&a.click()}})}function Y(e){const t={combat:{attr:3,skill:2,dv:3,position:"controlled",boons:0},stealth:{attr:2,skill:3,dv:4,position:"controlled",boons:0},social:{attr:2,skill:2,dv:3,position:"controlled",boons:0},magic:{attr:1,skill:4,dv:5,position:"controlled",boons:0},desperate:{attr:2,skill:2,dv:4,position:"desperate",boons:0},deterministic:{attr:3,skill:3,dv:4,position:"controlled",boons:1}}[e];t&&(document.getElementById("roll-attr").value=t.attr,document.getElementById("roll-skill").value=t.skill,document.getElementById("roll-dv").value=t.dv,document.getElementById("roll-position").value=t.position,document.getElementById("roll-boons").value=t.boons,setTimeout(()=>{const o=document.getElementById("roll-btn");o&&o.click()},100))}function K(){try{const e=document.getElementById("roll-attr"),t=document.getElementById("roll-skill"),o=document.getElementById("roll-dv"),n=document.getElementById("roll-position"),l=document.getElementById("roll-boons");if(!e||!t||!o||!n||!l){console.error("Form elements not found");return}const s=b(e.value,2),a=b(t.value,1),c=b(o.value,3),d=n.value,i=b(l.value,0);if(isNaN(s)||isNaN(a)||isNaN(c)||isNaN(i)){$("Invalid input values. Please check your selections.");return}console.log("Rolling with:",{attr:s,skill:a,dv:c,position:d,boons:i});const r=H(s,a,c,d,i);try{const v=r.resultText||r.outcome||"Unknown";O(`🎲 Dice roll: ${v} (${r.successes||0} successes, ${r.storyBeats||0} SB)`,"info"),F("dice_roll",{attr:s,skill:a,dv:c,position:d,pool:r.pool,dice:r.dice,successes:r.successes,storyBeats:r.storyBeats,outcome:r.outcome,outcomeClass:r.outcomeClass})}catch{}if(!r||typeof r!="object"){console.error("Invalid result from performRoll:",r),$("Failed to perform roll. Please try again.");return}const N={id:Date.now().toString(),timestamp:new Date().toISOString(),attr:s,skill:a,dv:c,position:d,boons:i,pool:r.pool,dice:r.dice,initialDice:r.initialDice,successes:r.successes,storyBeats:r.storyBeats,outcome:r.outcome,resultText:r.resultText,outcomeClass:r.outcomeClass,reRolls:r.reRolls,reRolledDice:r.reRolledDice,rerollSuccesses:r.rerollSuccesses,rerollStoryBeats:r.rerollStoryBeats,deterministic:!!f(),seed:f(),sender:"You"};if(_(N),Z(r),D(),B(),R())try{U("roll-result",N)}catch(v){console.warn("[Dice] Could not broadcast roll:",v)}}catch(e){console.error("Error during roll:",e),$(e.message||"An unexpected error occurred during the roll.")}}function $(e){const t=document.getElementById("roll-result");t&&(t.style.display="block",t.innerHTML=`
            <div style="text-align:center;padding:0.5rem;color:var(--red);">
                <div style="font-weight:bold;">❌ Error</div>
                <div style="font-size:0.9rem;color:var(--text2);">${y(String(e))}</div>
            </div>
        `)}function Z(e){const t=document.getElementById("roll-result");if(!t)return;const o={"clean-success":"var(--green)","success-with-sb":"var(--gold)",partial:"var(--orange)",miss:"var(--red)"}[e.outcomeClass]||"var(--text)";let n="";e.outcomeClass==="partial"?n=" (+1 Boon)":e.outcomeClass==="miss"&&(n=" (+2 Boons)");const l=e.dice&&Array.isArray(e.dice)?e.dice.join(", "):"";let s="";e.reRolls>0&&e.reRolledDice&&Array.isArray(e.reRolledDice)&&(s=`(rerolled: ${e.reRolledDice.map(d=>`${d.old}→${d.new}`).join(", ")})`);let a="";const c=f();c&&(a=`<div style="font-size:0.6rem;color:var(--text3);margin-top:0.2rem;">🎲 seeded: ${c.substring(0,8)}...</div>`),t.style.transition="transform 0.3s ease, opacity 0.3s ease",t.style.transform="scale(0.95)",t.style.opacity="0.7",t.style.display="block",t.innerHTML=`
        <div style="text-align:center;padding:0.5rem;">
            <div style="font-size:2rem;font-weight:bold;color:${o};">
                ${y(e.resultText||"Unknown")}${n}
            </div>
            <div style="font-size:0.9rem;color:var(--text2);margin-top:0.3rem;">
                Pool: ${e.pool||0} | Successes: ${e.successes||0} | DV: ${e.dv||0} | Story Beats: ${e.storyBeats||0}
            </div>
            <div style="font-size:0.8rem;color:var(--text3);margin-top:0.2rem;">
                Dice: [${y(l)}] ${y(s)}
            </div>
            <div style="font-size:0.7rem;color:var(--text3);margin-top:0.2rem;">
                ${y(e.position||"controlled")} position${e.boons>0?` +${e.boons} boons`:""}
            </div>
            ${e.storyBeats>0?`<div style="font-size:0.8rem;color:var(--gold);margin-top:0.2rem;">✨ ${e.storyBeats} Story Beat${e.storyBeats>1?"s":""} for the GM</div>`:""}
            ${a}
        </div>
    `,setTimeout(()=>{t.style.transform="scale(1)",t.style.opacity="1"},100)}function D(){const e=document.getElementById("roll-history");if(e)try{const t=x().diceHistory||[];if(t.length===0){e.innerHTML='<span class="text-muted">No rolls yet.</span>';return}e.innerHTML=t.slice(0,20).map((o,n)=>{try{const l=o.timestamp?new Date(o.timestamp).toLocaleTimeString():"--:--:--";let s="var(--text2)";o.outcomeClass==="clean-success"||o.outcomeClass==="success-with-sb"?s="var(--green)":o.outcomeClass==="partial"?s="var(--orange)":o.outcomeClass==="miss"&&(s="var(--red)");const a=o.dice&&Array.isArray(o.dice)?o.dice.join(","):"";let c="";o.reRolls>0&&o.reRolledDice&&Array.isArray(o.reRolledDice)&&(c=` ↻${o.reRolledDice.map(r=>`${r.old}→${r.new}`).join(", ")}`);const d={dominant:"👑",controlled:"⚖️",desperate:"🔥"}[o.position]||"",i=o.deterministic?"🎲":"🔀";return`
                    <div class="history-item" style="display:flex;justify-content:space-between;align-items:center;padding:0.3rem 0;border-bottom:1px solid var(--border);font-size:0.85rem;gap:0.5rem;">
                        <div style="display:flex;flex-wrap:wrap;gap:0.3rem;align-items:center;">
                            <span style="font-size:0.7rem;color:var(--text3);">${o.remote?`🌐 ${o.sender||"Remote"}`:i}</span>
                            <span style="font-weight:500;">${o.attr||0}+${o.skill||0}</span>
                            <span class="text-muted" style="font-size:0.75rem;">vs DV${o.dv||0}</span>
                            <span style="font-size:0.75rem;">${d}</span>
                            <span style="color:${s};font-weight:500;">${y(String(o.resultText||o.outcome||"Unknown"))}</span>
                            ${o.storyBeats>0?` <span style="color:var(--gold);font-weight:500;">✨${o.storyBeats}</span>`:""}
                        </div>
                        <div style="font-size:0.7rem;color:var(--text3);text-align:right;flex-shrink:0;">
                            <span style="background:var(--bg3);padding:0.05rem 0.4rem;border-radius:8px;">[${y(a)}]</span>
                            ${c}
                            <span class="text-muted" style="margin-left:0.3rem;">${l}</span>
                        </div>
                    </div>
                `}catch(l){return console.error("Error rendering history item:",l),""}}).filter(o=>o!=="").join("")||'<span class="text-muted">No rolls yet.</span>',e.scrollTop=e.scrollHeight}catch(t){console.error("Error rendering history:",t),e.innerHTML='<span class="text-muted">Error loading history.</span>'}}function B(){const e=document.getElementById("roll-stats");if(e)try{const t=x().diceHistory||[],o=t.length;if(o===0){e.textContent="";return}const n=t.filter(i=>i.outcomeClass==="clean-success"||i.outcomeClass==="success-with-sb").length,l=t.filter(i=>i.outcomeClass==="partial").length,s=t.filter(i=>i.outcomeClass==="miss").length,a=t.reduce((i,r)=>i+(r.storyBeats||0),0),c=t.filter(i=>i.deterministic).length,d=t.filter(i=>i.remote).length;e.innerHTML=`
            <span>📊 ${o} rolls</span>
            <span style="color:var(--green);">✅ ${n}</span>
            <span style="color:var(--orange);">⏳ ${l}</span>
            <span style="color:var(--red);">❌ ${s}</span>
            <span style="color:var(--gold);">✨ ${a}</span>
            ${c>0?`<span style="color:var(--text3);font-size:0.7rem;">🎲 ${c}</span>`:""}
            ${d>0?`<span style="color:var(--text3);font-size:0.7rem;">🌐 ${d}</span>`:""}
        `}catch(t){console.error("Error updating stats:",t),e.textContent=""}}function ee(){if(confirm("Clear all roll history?"))try{const e=x();e.diceHistory=[],z(),D(),B();const t=document.getElementById("roll-result");t&&(t.style.display="none")}catch(e){console.error("Error clearing history:",e),alert("Failed to clear history. Please try again.")}}function te(){try{const e=x().diceHistory||[];if(e.length===0){alert("No roll history to export.");return}const t=JSON.stringify(e,null,2),o=new Blob([t],{type:"application/json"}),n=URL.createObjectURL(o),l=document.createElement("a");l.href=n,l.download=`dice-history-${new Date().toISOString().slice(0,10)}.json`,document.body.appendChild(l),l.click(),document.body.removeChild(l),URL.revokeObjectURL(n)}catch(e){console.error("Error exporting history:",e),alert("Failed to export history. Please try again.")}}async function oe(e){try{const t=await S();if(t&&t.getSeed){const o=t.getSeed();o&&(E(o),console.log("[Dice] Seed loaded from crypto module on init"))}}catch{}return w(e)}function ne(){A(),m=null}var ce={render:w,init:oe,destroy:ne,getSeed:f,setSeed:E,generateSeed:M,getRandom:k,getRandomInt:X,getRandomIntInclusive:q,Xorshift128:g};export{ce as default,ne as destroy,oe as init,w as render};
