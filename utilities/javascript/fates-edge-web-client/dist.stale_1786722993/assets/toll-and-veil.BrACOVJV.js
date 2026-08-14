import{t as C}from"./rolldown-runtime.BQ-_32WO.js";var W=["♣","♠","♡","♢"],B=["♡","♢"],w=["2","3","4","5","6","7","8","9","10","J","Q","K","A"],$=Object.fromEntries(w.map((t,e)=>[t,e+2])),_=$.A;function L(){const t=[];for(const e of W)for(const r of w)t.push({suit:e,rank:r,value:$[r]});return t}function U(t){for(let e=t.length-1;e>0;e--){const r=Math.floor(Math.random()*(e+1));[t[e],t[r]]=[t[r],t[e]]}return t}function x(t){return`${t.rank}${t.suit}`}function T(t){return`${t.rank}${t.suit}`}function M(t){return Math.min(Math.max(t,3),5)}var E=class{constructor(t=3,e={}){this.numSeats=M(t),this.winningScore=e.winningScore||15,this.rng=e.rng||Math.random,this.deck=[],this.hands=[],this.trump=null,this.trumpFamily=null,this.trumpBroken=!1,this.currentTrick=[],this.leadSuit=null,this.trickNumber=0,this.trickWinner=null,this.bids=[],this.currentSeat=0,this.phase="bidding",this.scores=new Array(this.numSeats).fill(0),this.tricksWon=[],this.trick5Winner=null,this.trick6Winner=null,this.rootedPenaltyApplied=[],this.markerUsed=[],this.dealerIndex=0,this.log=[],this.gameWinner=null,this.onUpdate=null}startHand(){this.deck=U(L()),this._deal(),this.bids=[],this.tricksWon=new Array(this.numSeats).fill(0),this.rootedPenaltyApplied=new Array(this.numSeats).fill(!1),this.markerUsed=new Array(this.numSeats).fill(null).map(()=>({cut:!1,leap:!1})),this.currentTrick=[],this.trickNumber=0,this.trickWinner=null,this.trick5Winner=null,this.trick6Winner=null,this.leadSuit=null,this.trumpBroken=!1,this.phase="bidding";const t=this.deck[this.deck.length-1];this.trump=t.suit,this.trumpFamily=B.includes(this.trump)?"Toll":"Veil",this._log(`Trump: ${this.trump} — playing in ${this.trumpFamily}.`),this.currentSeat=(this.dealerIndex+1)%this.numSeats,this._fireUpdate()}_deal(){this.hands=new Array(this.numSeats).fill(null).map(()=>[]);for(let t=0;t<10*this.numSeats;t++){const e=this.deck.pop();if(!e)break;this.hands[t%this.numSeats].push(e)}}makeBid(t,e){if(this.phase!=="bidding")return{ok:!1,reason:"not-bidding"};if(t!==this.currentSeat)return{ok:!1,reason:"not-your-turn"};if(!Number.isInteger(e)||e<0||e>5)return{ok:!1,reason:"bad-bid"};if(this.bids.some(r=>r.seat===t))return{ok:!1,reason:"already-bid"};if(this.bids.length===this.numSeats-1&&this.bids.reduce((r,s)=>r+s.bid,0)+e===10)return{ok:!1,reason:"sum-would-equal-tricks"};if(this.bids.push({seat:t,bid:e}),this._log(`Seat ${t+1} bids ${e}`),this.bids.length===this.numSeats)this.phase="playing",this.currentSeat=(this.dealerIndex+1)%this.numSeats,this.trickNumber=1,this._log("Bidding complete. Play begins.");else{let r=(this.currentSeat+1)%this.numSeats;for(;this.bids.some(s=>s.seat===r);)r=(r+1)%this.numSeats;this.currentSeat=r}return this._fireUpdate(),{ok:!0}}playCard(t,e,r={}){const s=!!r.cut,n=!!r.leap;if(this.phase!=="playing")return{ok:!1,reason:"not-playing"};if(t!==this.currentSeat)return{ok:!1,reason:"not-your-turn"};const a=this.hands[t],u=a.findIndex(p=>x(p)===e);if(u===-1)return{ok:!1,reason:"card-not-in-hand"};const d=a[u],l=this.markerUsed[t];if(s&&l.cut)return{ok:!1,reason:"cut-already-used"};if(n&&l.leap)return{ok:!1,reason:"leap-already-used"};if(s&&d.value===_)return{ok:!1,reason:"cannot-cut-an-ace"};const h=this.leadSuit===null,m=d.suit===this.trump,i=a.every(p=>p.suit===this.trump);if(h){if(m&&!this.trumpBroken&&!i&&!n)return{ok:!1,reason:"trump-not-broken"}}else if(a.some(p=>p.suit===this.leadSuit)){if(d.suit!==this.leadSuit)return{ok:!1,reason:"must-follow-suit"}}else if(m&&!this.trumpBroken&&!i&&!n)return{ok:!1,reason:"trump-not-broken"};a.splice(u,1),this.currentTrick.push({seat:t,card:d,cut:s,leap:n}),s&&(l.cut=!0),n&&(l.leap=!0),h&&(this.leadSuit=d.suit),m&&(this.trumpBroken=!0);const o=s?" ✂️":"",c=n?" 🦘":"";return this._log(`Seat ${t+1} plays ${T(d)}${o}${c}`),this.currentSeat=(this.currentSeat+1)%this.numSeats,this.currentTrick.length===this.numSeats?this._resolveTrick():this._fireUpdate(),{ok:!0}}_effectiveValue(t){return t.cut?t.card.value+1:t.card.value}_resolveTrick(){let t=this.currentTrick[0];for(const s of this.currentTrick.slice(1)){const n=t.card.suit===this.trump,a=s.card.suit===this.trump,u=t.card.suit===this.leadSuit,d=s.card.suit===this.leadSuit;let l=!1;a&&!n?l=!0:a&&n?l=this._effectiveValue(s)>this._effectiveValue(t):!a&&!n&&(d&&!u?l=!0:d&&u&&(l=this._effectiveValue(s)>this._effectiveValue(t))),l&&(t=s)}const e=t.seat;if(this.tricksWon[e]++,this.trickWinner=e,this.trickNumber===5&&(this.trick5Winner=e),this.trickNumber===6&&(this.trick6Winner=e),this._log(`Trick ${this.trickNumber} won by seat ${e+1}`),this.trickNumber++,this.currentTrick=[],this.leadSuit=null,this.trickNumber>10){this._endHand();return}this.currentSeat=e;const r=this.markerUsed[e];r.cut&&r.leap&&!this.rootedPenaltyApplied[e]&&(this.rootedPenaltyApplied[e]=!0,this._log(`Seat ${e+1} is Rooted (both markers spent) — passes the lead.`,"warning"),this.currentSeat=(this.currentSeat+1)%this.numSeats),this._fireUpdate()}_endHand(){this.phase="scoring";const t=new Array(this.numSeats).fill(0);for(let e=0;e<this.numSeats;e++){const r=this.bids.find(u=>u.seat===e),s=r?r.bid:0,n=this.tricksWon[e];let a=0;n>=s?a+=2+(n-s):a-=s-n,this.trick5Winner===e&&this.trick6Winner!==e&&(a+=1),s===0&&n===0&&(a+=3),t[e]=a,this.scores[e]+=a}this._log("Hand scores: "+this.scores.map((e,r)=>`Seat ${r+1}: ${t[r]} (total ${e})`).join("  "));for(let e=0;e<this.numSeats;e++)if(this.scores[e]>=this.winningScore){this.gameWinner=e,this.phase="game_over",this._log(`🏆 Seat ${e+1} wins the game with ${this.scores[e]} points!`,"winner"),this._fireUpdate();return}this.dealerIndex=(this.dealerIndex+1)%this.numSeats,this.startHand()}getPublicState(){return{numSeats:this.numSeats,winningScore:this.winningScore,trump:this.trump,trumpFamily:this.trumpFamily,trumpBroken:this.trumpBroken,currentTrick:this.currentTrick.map(t=>({seat:t.seat,card:t.card,cut:t.cut,leap:t.leap})),leadSuit:this.leadSuit,trickNumber:this.trickNumber,trickWinner:this.trickWinner,bids:this.bids,currentSeat:this.currentSeat,phase:this.phase,scores:[...this.scores],tricksWon:[...this.tricksWon],markerUsed:this.markerUsed.map(t=>({...t})),dealerIndex:this.dealerIndex,gameWinner:this.gameWinner,handCounts:this.hands.map(t=>t.length),log:this.log.slice(-40)}}getSeatView(t){return{...this.getPublicState(),seat:t,hand:(this.hands[t]||[]).map(e=>({...e,id:x(e)}))}}_log(t,e="info"){this.log.push({msg:t,type:e,t:Date.now()}),this._fireUpdate()}_fireUpdate(){this.onUpdate&&this.onUpdate()}};function P(t,e){const r=t.bids.length===t.numSeats-1,s=t.bids.reduce((a,u)=>a+u.bid,0),n=[0,1,2,3,4,5];if(r){const a=n.filter(u=>s+u!==10);return a[Math.floor(Math.random()*a.length)]}return n[Math.floor(Math.random()*n.length)]}function A(t,e){const r=t.hands[e],s=t.markerUsed[e],n=t.leadSuit===null,a=r.every(l=>l.suit===t.trump),u=t.leadSuit!==null&&r.some(l=>l.suit===t.leadSuit),d=r.map(l=>{const h=l.suit===t.trump;let m=!0,i=!1;return n?h&&!t.trumpBroken&&!a&&(i=!0,m=!!s.leap):u?m=l.suit===t.leadSuit:h&&!t.trumpBroken&&!a&&(i=!0,m=!!s.leap),{card:l,isTrump:h,legal:m,needsLeap:i}}).filter(l=>l.legal);return d.length?d:r.map(l=>({card:l,isTrump:l.suit===t.trump,needsLeap:l.suit===t.trump&&!t.trumpBroken&&!a}))}function j(t,e){const r=t.hands[e],s=t.markerUsed[e],n=t.leadSuit===null,a=t.leadSuit!==null&&r.some(i=>i.suit===t.leadSuit),u=A(t,e);let d;const l=u.filter(i=>i.isTrump);if(l.length>0&&(n||!a))l.sort((i,o)=>o.card.value-i.card.value),d=l[0];else if(a){const i=u.filter(o=>o.card.suit===t.leadSuit);i.sort((o,c)=>c.card.value-o.card.value),d=i[0]||u[0]}else d=[...u].sort((i,o)=>o.card.value-i.card.value)[0];const h=!s.leap&&!!d.needsLeap,m=!s.cut&&d.card.value!==_&&d.card.value>=10;return{id:x(d.card),cut:m,leap:h}}var D=C({closeTollVeilModal:()=>k,createLocalController:()=>I,openTollVeilModal:()=>F}),z={"♣":"#cfd2e3","♠":"#cfd2e3","♡":"#e18a95","♢":"#e18a95"};function I({numSeats:t=3,aiSeats:e=[],winningScore:r,localSeat:s=0,stakeConfig:n={mode:"points"}}={}){const a=new E(t,{winningScore:r}),u=new Set(e),d=new Set;let l=null;function h(){d.forEach(i=>{try{i()}catch{}})}a.onUpdate=h;function m(){if(clearTimeout(l),a.phase==="game_over")return;const i=a.currentSeat;u.has(i)&&(l=setTimeout(()=>{if(a.phase==="bidding"&&a.currentSeat===i)a.makeBid(i,P(a,i));else if(a.phase==="playing"&&a.currentSeat===i){const o=j(a,i);a.playCard(i,o.id,{cut:o.cut,leap:o.leap})}},550+Math.random()*500))}return d.add(m),a.startHand(),{numSeats:t,seatNames:Array.from({length:t},(i,o)=>u.has(o)?`AI ${o+1}`:o===s?"You":`Seat ${o+1}`),localSeat:s,stakeConfig:n,getView(){const i=a.getPublicState(),o=s!=null?a.getSeatView(s).hand:[];return{...i,myHand:o}},canBid(){return a.phase==="bidding"&&a.currentSeat===s&&!u.has(s)},canPlay(){return a.phase==="playing"&&a.currentSeat===s&&!u.has(s)},legalIds(){return a.phase!=="playing"?null:A(a,s)},bid(i){return a.makeBid(s,i)},play(i,o){return a.playCard(s,i,o)},requestNewGame(){a.dealerIndex=(a.dealerIndex+1)%a.numSeats,a.scores=new Array(a.numSeats).fill(0),a.gameWinner=null,a.startHand()},onChange(i){return d.add(i),()=>d.delete(i)},destroy(){clearTimeout(l),d.clear(),a.onUpdate=null},_engine:a}}var v=null,g=null,b=null,y=null;function V(){if(document.getElementById("tv-style"))return;const t=document.createElement("style");t.id="tv-style",t.textContent=`
        #tv-modal * { box-sizing: border-box; }
        #tv-modal { --gold:#d4af37; --bg:#14151c; --panel:#1b1c26; --line:#2c2d3a; --ink:#e8e6df; --muted:#9a9aa8; }
        #tv-modal .tv-btn { background:#2a2b38; color:#e8e6df; border:1px solid #3a3b4a; padding:7px 14px;
            border-radius:6px; cursor:pointer; font-size:13px; transition: background .15s ease; }
        #tv-modal .tv-btn:hover:not(:disabled) { background:#34364a; }
        #tv-modal .tv-btn:disabled { opacity:0.35; cursor:not-allowed; }
        #tv-modal .tv-btn.primary { background:var(--gold); color:#1a1400; border-color:var(--gold); font-weight:600; }
        #tv-modal .tv-btn.primary:hover:not(:disabled) { background:#e6c250; }
        #tv-modal .tv-card { display:inline-flex; align-items:center; justify-content:center; width:46px; height:64px;
            border-radius:6px; background:#22232f; border:1px solid #3a3b4a; font-weight:700; font-size:15px;
            cursor:pointer; user-select:none; transition: transform .1s ease, border-color .1s ease; }
        #tv-modal .tv-card:hover:not(.disabled) { transform: translateY(-4px); border-color: var(--gold); }
        #tv-modal .tv-card.disabled { opacity:0.3; cursor:not-allowed; }
        #tv-modal .tv-card.trump { box-shadow: 0 0 0 2px var(--gold) inset; }
        #tv-modal .tv-log { font-family: ui-monospace, Menlo, Consolas, monospace; font-size:11.5px; line-height:1.6; color:#b9b8c8; }
        #tv-modal .tv-scroll::-webkit-scrollbar { width:8px; }
        #tv-modal .tv-scroll::-webkit-scrollbar-thumb { background:#3a3b4a; border-radius:4px; }
        #tv-modal .tv-seat { border:1px solid var(--line); border-radius:8px; padding:8px 10px; min-width:110px; }
        #tv-modal .tv-seat.active { border-color: var(--gold); box-shadow: 0 0 0 1px var(--gold); }
        #tv-modal .tv-marker { display:inline-block; padding:2px 7px; border-radius:10px; font-size:11px; margin-left:4px; }
        #tv-modal .tv-marker.on { background:var(--gold); color:#1a1400; font-weight:700; }
        #tv-modal .tv-marker.off { background:#2a2b38; color:var(--muted); }
    `,document.head.appendChild(t)}function S(t,e="",r=""){return`<div class="tv-card ${e}" style="color:${z[t.suit]||"#cfd2e3"};" ${r}>${T(t)}</div>`}function q(t,e){t.innerHTML=`
        <div style="text-align:center; color:var(--muted); font-size:13px; margin-bottom:10px;">Choose how to play.</div>
        <div style="display:flex; gap:8px; justify-content:center; margin-bottom:14px;">
            <button class="tv-btn primary" id="tv-mode-passplay">👥 Pass &amp; Play</button>
            <button class="tv-btn" id="tv-mode-vsai">🤖 Solo vs AI</button>
        </div>
        <div style="display:flex; align-items:center; gap:8px; justify-content:center; margin-bottom:14px; font-size:13px; color:var(--muted);">
            <span>Seats:</span>
            <div id="tv-seat-count-row" style="display:flex; gap:6px;">
                ${[3,4,5].map(s=>`<button class="tv-btn ${s===3?"primary":""}" data-seats="${s}">${s}</button>`).join("")}
            </div>
        </div>
        <p style="text-align:center; color:var(--text3, var(--muted)); font-size:12px; max-width:420px; margin:0 auto;">
            3–5 seats, 10 tricks a hand, bids 0–5. Trump breaks like Spades. Cut (+1 value, never on an Ace)
            and Leap (bypass trump-breaking once) are one-time markers each hand — spend both and you're
            <b>Rooted</b>: the next trick you win, you must pass the lead. First to the target score wins.
        </p>
    `;let r=3;t.querySelectorAll("#tv-seat-count-row button").forEach(s=>{s.onclick=()=>{r=parseInt(s.dataset.seats,10),t.querySelectorAll("#tv-seat-count-row button").forEach(n=>n.className="tv-btn"),s.className="tv-btn primary"}}),t.querySelector("#tv-mode-passplay").onclick=()=>e({seats:r,aiSeats:[]}),t.querySelector("#tv-mode-vsai").onclick=()=>e({seats:r,aiSeats:Array.from({length:r-1},(s,n)=>n+1)})}function H(t,e,r){const s=e.getView(),n=e.localSeat,a=s.currentSeat===n,u={points:"Points only",xp:`XP wager (cap ${e.stakeConfig?.xpCap??"?"})`,string:"String (narrative debt)"}[e.stakeConfig?.mode]||"Points only",d=Array.from({length:s.numSeats},(i,o)=>{const c=e.seatNames[o]||`Seat ${o+1}`,p=s.bids.find(N=>N.seat===o),f=s.markerUsed[o]||{cut:!1,leap:!1};return`
            <div class="tv-seat ${s.currentSeat===o&&s.phase!=="game_over"?"active":""}">
                <div style="font-weight:700; color:${o===n?"var(--gold)":"var(--ink)"};">${c}${s.dealerIndex===o?" 🃏":""}</div>
                <div style="font-size:12px; color:var(--muted);">Score: <b style="color:var(--ink);">${s.scores[o]}</b></div>
                <div style="font-size:12px; color:var(--muted);">Bid: ${p?p.bid:"—"} · Tricks: ${s.tricksWon[o]??0}</div>
                <div style="margin-top:4px;">
                    <span class="tv-marker ${f.cut?"on":"off"}">✂️ Cut</span>
                    <span class="tv-marker ${f.leap?"on":"off"}">🦘 Leap</span>
                </div>
            </div>
        `}).join(""),l=s.currentTrick.map(i=>`
        <div style="text-align:center;">
            ${S(i.card,i.card.suit===s.trump?"trump":"")}
            <div style="font-size:10px; color:var(--muted); margin-top:2px;">${e.seatNames[i.seat]||`S${i.seat+1}`}${i.cut?" ✂️":""}${i.leap?" 🦘":""}</div>
        </div>
    `).join("");let h="";if(s.phase==="bidding"){const i=s.bids.length===s.numSeats-1,o=s.bids.reduce((p,f)=>p+f.bid,0),c=Array.from({length:6},(p,f)=>f);h=`
            <div style="text-align:center; margin-top:10px;">
                <div style="color:var(--muted); font-size:13px; margin-bottom:6px;">
                    ${a?"Your bid — how many of this hand's tricks will you take?":`Waiting on ${e.seatNames[s.currentSeat]||"seat "+(s.currentSeat+1)}…`}
                </div>
                <div style="display:flex; gap:6px; justify-content:center; flex-wrap:wrap;">
                    ${c.map(p=>{const f=e.canBid()&&i&&o+p===10;return`<button class="tv-btn ${e.canBid()&&!f,""}" data-bid="${p}" ${e.canBid()&&!f?"":"disabled"}>${p}</button>`}).join("")}
                </div>
            </div>
        `}else if(s.phase==="playing"){const i=e.canPlay()&&e.legalIds?e.legalIds():null,o=i?new Map(i.map(c=>[c.card.rank+c.card.suit,c])):null;h=`
            <div style="margin-top:10px;">
                <div style="color:var(--muted); font-size:13px; text-align:center; margin-bottom:6px;">
                    ${a?"Your play.":`Waiting on ${e.seatNames[s.currentSeat]||"seat "+(s.currentSeat+1)}…`}
                    Trump: <b style="color:var(--gold);">${s.trump}</b> (${s.trumpFamily})${s.trumpBroken?" — broken":""}
                </div>
                <div style="display:flex; gap:6px; justify-content:center; align-items:center; margin-bottom:8px;">
                    <label style="font-size:12px; color:var(--muted); display:flex; align-items:center; gap:4px;">
                        <input type="checkbox" id="tv-use-cut"> ✂️ Cut (+1, no Aces)
                    </label>
                    <label style="font-size:12px; color:var(--muted); display:flex; align-items:center; gap:4px;">
                        <input type="checkbox" id="tv-use-leap"> 🦘 Leap (play trump early)
                    </label>
                </div>
                <div style="display:flex; gap:6px; justify-content:center; flex-wrap:wrap;">
                    ${s.myHand.map(c=>{const p=c.rank+c.suit,f=e.canPlay()&&(!o||o.has(p));return S(c,`${c.suit===s.trump?"trump":""} ${f?"":"disabled"}`,`data-card="${c.id}"`)}).join("")}
                </div>
            </div>
        `}else s.phase==="game_over"&&(h=`
            <div style="text-align:center; margin-top:14px;">
                <div style="font-size:18px; color:var(--gold); font-weight:700;">🏆 ${e.seatNames[s.gameWinner]||`Seat ${s.gameWinner+1}`} wins!</div>
                <div style="font-size:12px; color:var(--muted); margin-top:4px;">Stakes: ${u}</div>
                ${e.requestNewGame?'<button class="tv-btn primary" id="tv-new-game" style="margin-top:10px;">Play Again</button>':""}
            </div>
        `);t.innerHTML=`
        <div style="width:100%; display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <div>
                <h2 style="color:var(--gold); margin:0; font-size:20px; letter-spacing:0.02em;">Toll &amp; Veil</h2>
                <span style="color:var(--muted); font-size:12px;">Target: ${s.winningScore} points · ${u}</span>
            </div>
            <button class="tv-btn" id="tv-close">✕</button>
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap; justify-content:center; margin-bottom:10px;">${d}</div>
        <div style="min-height:80px; display:flex; gap:14px; justify-content:center; align-items:flex-end; padding:8px 0; border-top:1px solid var(--line); border-bottom:1px solid var(--line);">
            ${l||'<span style="color:var(--muted); font-size:12px;">No cards played yet this trick.</span>'}
        </div>
        ${h}
        <div class="tv-scroll tv-log" style="margin-top:12px; max-height:120px; overflow-y:auto; border-top:1px solid var(--line); padding-top:6px;">
            ${(s.log||[]).slice(-30).map(i=>`<div>${i.msg}</div>`).join("")}
        </div>
    `,t.querySelector("#tv-close").onclick=r,e.canBid()&&t.querySelectorAll("[data-bid]").forEach(i=>{i.onclick=()=>e.bid(parseInt(i.dataset.bid,10))}),e.canPlay()&&t.querySelectorAll("[data-card]").forEach(i=>{i.classList.contains("disabled")||(i.onclick=()=>{const o=t.querySelector("#tv-use-cut")?.checked,c=t.querySelector("#tv-use-leap")?.checked;e.play(i.dataset.card,{cut:o,leap:c})})});const m=t.querySelector("#tv-new-game");m&&(m.onclick=()=>e.requestNewGame())}function F(t={}){k(),V(),v=document.createElement("div"),v.id="tv-modal",v.className="editor-screen-host",v.style.cssText=`
        display: flex; align-items: center; justify-content: center;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 16px 0;
    `;const e=document.createElement("div");e.style.cssText=`
        background: var(--panel); border: 1px solid var(--line); border-radius: 12px;
        padding: 20px; max-width: 720px; width: 100%; color: var(--ink);
        box-shadow: 0 20px 60px rgba(0,0,0,0.5); max-height: 92vh; overflow: auto;
    `,v.appendChild(e);const r=document.getElementById("app-content")||document.body;y=Array.from(r.children),y.forEach(n=>{n.style.display="none"}),r.appendChild(v);function s(n){g=n;const a=()=>H(e,n,k);b=n.onChange(a),a()}return t.controller?s(t.controller):q(e,({seats:n,aiSeats:a})=>{s(I({numSeats:n,aiSeats:a,winningScore:t.winningScore,localSeat:0}))}),{destroy:k}}function k(){b&&(b(),b=null),g&&g.destroy&&g.destroy(),g=null,v&&(v.remove(),v=null),y&&(y.forEach(t=>{t.style.display=""}),y=null)}export{j as a,P as i,D as n,E as r,F as t};
