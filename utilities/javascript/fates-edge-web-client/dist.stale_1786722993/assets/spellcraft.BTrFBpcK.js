import{a as Y,g as ae,i as p,l as pe}from"./utils.lBShoim5.js";import{D as He,b as E,g as Dr,j as et}from"./state.42sFgcOQ.js";import{n as l}from"./Toast.DDAtBIAw.js";import{t as ue}from"./preload-helper.BATLnrmA.js";import{T as Nr,p as Wt}from"./websocket.Dmklt06W.js";import{n as De}from"./patrons.Ci1TYIUN.js";import{t as _e}from"./vtt-store.Dch8u3Zx.js";var{loadPatronData:Gt,getPatronObligation:ve,setPatronObligation:Re,savePatronData:Ae}=De,qt={aveh:["oath-of-flame-light","varnek-karn","sealed-gate"],"oath-of-flame-light":["aveh","khemesh","ikasha"],ikasha:["oath-of-flame-light","the-witness"],"the-witness":["ikasha","silent-choir"],raeyn:["khemesh"],khemesh:["raeyn","oath-of-flame-light"],livaea:["maelstraeus"],maelstraeus:["livaea","morag-the-hag"],"morag-the-hag":["maelstraeus"],thrysos:["palinode"],palinode:["thrysos"]};function C(e){if(e==null)return"";if(typeof e=="string")return e;if(typeof e=="number"||typeof e=="boolean")return String(e);if(Array.isArray(e))return e.map(t=>C(t)).join(", ");if(typeof e=="object"){if(e.name)return C(e.name);if(e.label)return C(e.label);if(e.description)return C(e.description);if(e.effect)return C(e.effect);if(e.text)return C(e.text);if(e.quote)return C(e.quote);if(e.lore)return C(e.lore);try{return JSON.stringify(e)}catch{return"[object]"}}return String(e)}function K(e){return e?p(e).replace(/\n/g,"<br>"):""}function Or(e,t){const r={Cantrip:0,Basic:1,Low:1,Standard:2,Advanced:3,Master:4,Epic:5,High:6},n=r[e.tier]??99,o=r[t.tier]??99;return n!==o?n-o:(e.name||"").localeCompare(t.name||"")}function rr(e){return{Cantrip:"var(--text3)",Basic:"#6baa7a",Low:"#6baa7a",Standard:"#d4af37",Advanced:"#c47a7a",Master:"#b84a8a",Epic:"#d94a4a",High:"#8e44ad"}[e]||"var(--text2)"}function Wr(e){return{Cantrip:"🎵",Basic:"🟢",Low:"🟢",Standard:"🟡",Advanced:"🟠",Master:"🔴",Epic:"🟣",High:"👑"}[e]||"📜"}function _t(e,t){if(!e)return e;const r=me(t,e);return r?.name||r?.title||e}function me(e,t){if(!t)return null;let r=Vt(e,t);if(r)return r;const n=E();return n!==e&&(r=Vt(n,t),r)?r:null}function Vt(e,t){if(!e?.patrons)return null;if(e.patrons.cosmic){const r=e.patrons.cosmic.find(n=>n.id===t);if(r)return r}if(e.patrons.terrestrial){const r=e.patrons.terrestrial.find(n=>n.id===t);if(r)return r}if(e.patrons.religions){for(const r of e.patrons.religions)if(r.orders){const n=r.orders.find(o=>o.id===t);if(n)return{...n,_religion:r.name,_religionIcon:r.icon}}}return null}function Gr(e){const t=[];for(let r=0;r<e.length;r++)for(let n=r+1;n<e.length;n++){const o=e[r],i=e[n];(qt[o]?.includes(i)||qt[i]?.includes(o))&&t.push([o,i])}return t}function kt(e){return e&&e.patrons_gift||null}function St(e){const t=C(e?.cost||"").match(/\+\s*(\d+)\s*Obligation/i);return t?parseInt(t[1],10):1}var qr=[{min:0,max:40,tier:"I",name:"Novice"},{min:41,max:90,tier:"II",name:"Seasoned"},{min:91,max:150,tier:"III",name:"Veteran"},{min:151,max:220,tier:"IV",name:"Paragon"},{min:221,max:1/0,tier:"V",name:"Mythic"}],ft={I:1,II:2,III:3,IV:4,V:5};function Tt(e){if(e&&e.tier&&ft[e.tier])return e.tier;const t=e&&e.totalXp||0,r=qr.find(n=>t>=n.min&&t<=n.max);return r?r.tier:"I"}function nr(e,t){return(ft[Tt(e)]||1)>=(ft[t]||1)}function or(e,t){return`${e}::${t}`}function tt(e,t,r){const n=e&&e.rites||[];return n.includes(or(t,r))?!0:n.includes(r)}function Ne(e){typeof window.sendToVTT=="function"?window.sendToVTT(e,"System",{isHTML:!0}):console.warn("[Rites] VTT not available — message not sent.")}function ir(e,t,r,n,o,i=""){return`
        <div style="
            background:var(--bg2);
            border-radius:var(--radius);
            padding:0.5rem 0.8rem;
            border:1px solid var(--border);
            border-left:4px solid var(--gold);
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            max-width: 450px;
            margin:0.1rem 0;
            font-family: inherit;
        ">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.2rem;">
                <div style="display:flex;align-items:center;gap:0.3rem;">
                    <span style="font-size:1.2rem;">${p(r||"🔮")}</span>
                    <span style="font-weight:700;font-size:1.05rem;color:var(--gold);">${p(e)}</span>
                </div>
                <span style="font-size:0.65rem;color:var(--text3);">${p(t)}</span>
            </div>
            ${n?`<div style="font-size:0.8rem;color:var(--text);margin-top:0.2rem;line-height:1.4;">${K(n)}</div>`:""}
            ${o?`<div style="font-size:0.7rem;color:var(--text3);margin-top:0.15rem;">${K(o)}</div>`:""}
            ${i?`<div style="font-size:0.65rem;color:var(--text3);margin-top:0.1rem;">${K(i)}</div>`:""}
        </div>
    `}function Ct(e,t,r,n,o,i=""){return`
        <div style="
            background:var(--bg2);
            border-radius:var(--radius);
            padding:0.5rem 0.8rem;
            border:1px solid var(--border);
            border-left:4px solid var(--gold);
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            max-width: 450px;
            margin:0.1rem 0;
            font-family: inherit;
        ">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.2rem;">
                <div style="display:flex;align-items:center;gap:0.3rem;">
                    <span style="font-size:1.2rem;">${p(r||"📜")}</span>
                    <span style="font-weight:700;font-size:1.05rem;color:var(--gold);">${p(e)}</span>
                </div>
                <span style="font-size:0.65rem;color:var(--text3);">${p(t)}</span>
            </div>
            ${n?`<div style="font-size:0.8rem;color:var(--text);margin-top:0.2rem;line-height:1.4;">${K(n)}</div>`:""}
            ${o?`<div style="font-size:0.7rem;color:var(--text3);margin-top:0.15rem;">${K(o)}</div>`:""}
            ${i?`<div style="font-size:0.65rem;color:var(--text3);margin-top:0.1rem;">${K(i)}</div>`:""}
        </div>
    `}async function _r(e,t,r,n={}){if(!e)return;await Gt();const o=g=>g.replace(/_/g,"-").toLowerCase();let i=Array.isArray(t)?t:t?[t]:[];i=i.map(o).filter(g=>g&&g.trim()!=="");const a=n.path||"runekeeper",s=n.characterName||"Character",c=E(),d=c.characters?.find(g=>g.id===r)||c.characters?.[r];if(!d){e.innerHTML='<div class="panel" style="padding:0.5rem;text-align:center;color:var(--text3);">Character not found.</div>';return}if(console.log("[Rites] Received patronIds (after normalization):",i),console.log("[Rites] Available cosmic patrons:",c.patrons?.cosmic?.map(g=>g.id)||[]),i.length===0){let g="";d.magicPath==="invoker"?g="Add Symbols in the Character Editor (Invoker tab).":d.magicPath==="runekeeper"?g="Set a Bound Patron in the Character Editor (Runekeeper tab).":d.magicPath==="cantor"?g="Set a Bound Patron in the Character Editor (Cantor tab).":g="Select a magic path that uses patrons (Invoker, Runekeeper, Cantor) in the Character Editor.",e.innerHTML=`
            <div class="panel" style="padding:0.5rem;text-align:center;color:var(--text3);border:1px dashed var(--border);">
                <div style="font-size:1.5rem;">🔮</div>
                <p>No patron selected for this character.</p>
                <p style="font-size:0.85rem;">${g}</p>
            </div>
        `;return}let m=[],u=[],f=!1;const h=()=>{m=[],u=[];for(const g of i){if(!g)continue;let w=me(c,g);if(!w&&g.includes("-")){const T=g.replace(/-/g,"_");w=me(c,T)}w?m.push(w):u.push(g)}};if(h(),u.length>0&&!f&&(console.warn("[Rites] Patrons not found:",u,"– forcing reload of patron data."),await Gt(!0),f=!0,h()),u.length>0){console.warn("[Rites] Still missing some patrons after reload – creating dummy entries for:",u);for(const g of u)m.push({id:g,name:`Unknown Patron (${g})`,title:"Unknown",icon:"❓",description:"This patron could not be loaded from the data files. Please check the patron ID or refresh the data.",rites:[],patrons_gift:null,color:"var(--text3)",_dummy:!0});u=[]}if(m.length===0){e.innerHTML=`
            <div class="panel" style="padding:0.5rem;text-align:center;color:var(--text3);">
                <div style="font-size:1.5rem;">🔮</div>
                <p>No patron data found for any of the provided IDs.</p>
                <p style="font-size:0.85rem;">Try refreshing the patrons tab or check the console for details.</p>
                <button class="btn btn-sm btn-secondary" onclick="window.refreshPatrons && window.refreshPatrons()">🔄 Refresh Patrons</button>
            </div>
        `;return}let y="";const b=a==="invoker",$=m.length>1;if(b&&$){const g=Gr(m.map(w=>w.id));g.length>0&&(y+=`
                <div class="info-box" style="border-left-color:var(--orange);margin-bottom:0.5rem;">
                    <strong>⚠️ Cross-Resonance Warning:</strong> Carrying symbols from rival patrons:
                    ${g.map(([w,T])=>`<span style="color:var(--orange);">${_t(w,c)} & ${_t(T,c)}</span>`).join("; ")}
                    <br><span style="font-size:0.7rem;color:var(--text3);">Using rites from rival patrons simultaneously may incur additional Obligation or complications.</span>
                </div>
            `)}y+=`
        <div style="display:flex;justify-content:flex-end;margin-bottom:0.5rem;">
            <button class="btn btn-sm btn-secondary" onclick="window.startNewScene('${r}')">🎬 New Scene</button>
        </div>
    `;for(const g of m){const w=Vr(d,g,a,r);w&&(y+=w);const T=Ur(g,r,s,i,a,d);y+=T}e.innerHTML=y,Xr(e)}function Vr(e,t,r,n){const o=kt(t);if(!o)return"";const i=r==="runekeeper",a=r==="invoker",s=t.id,c=t.name||t.title,d=t.icon||"🔮",m=C(o.name||"Patron's Gift"),u=C(o.description||""),f=C(o.effect||""),h=C(o.cost||"+1 Obligation"),y=`
        <option value="boon">1 Boon</option>
        <option value="fatigue">1 Fatigue</option>
    `,b=a&&(e.compromisedSymbols||[]).includes(s),$=!!(e.sceneFlags&&e.sceneFlags.borrowedGrace);return`
        <div class="patron-gifts" style="background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;border-left:4px solid var(--gold);margin-bottom:0.3rem;">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.2rem;">
                <span style="font-size:0.85rem;font-weight:600;color:var(--gold);">${i?"🔮 Patron's Gift":"🎴 Borrowed Grace (Symbol)"}</span>
                <span style="font-size:0.6rem;color:var(--text3);">${a&&$?"used this scene":""}</span>
            </div>
            <div class="gift-item" style="display:flex;flex-direction:column;gap:0.2rem;padding:0.2rem 0.3rem;border-bottom:1px solid var(--border);background:var(--bg3);border-radius:var(--radius);margin-top:0.1rem;">
                <div style="display:flex;align-items:center;gap:0.3rem;flex-wrap:wrap;">
                    <span style="font-size:1.1rem;">${d}</span>
                    <span style="font-weight:600;font-size:0.85rem;">${p(m)}</span>
                    <span style="font-size:0.6rem;color:var(--text3);">${p(c)}</span>
                    ${i?'<span style="font-size:0.55rem;color:var(--gold);">(Bound)</span>':'<span style="font-size:0.55rem;color:var(--orange);">(Symbol)</span>'}
                    ${b?'<span style="font-size:0.55rem;color:var(--red);">⚠️ Compromised: −1 die</span>':""}
                </div>
                <div style="font-size:0.75rem;color:var(--text2);">${K(u)}</div>
                <div style="font-size:0.7rem;color:var(--text3);">${K(f)}</div>
                <div style="display:flex;flex-wrap:wrap;gap:0.2rem;align-items:center;margin-top:0.1rem;">
                    <span style="font-size:0.65rem;color:var(--text3);">Cost: ${p(h)}</span>
                    ${i?`
                        <button class="btn btn-xs btn-primary" onclick="window.usePatronGift('${s}', '${n}')" style="font-size:0.6rem;">Use Gift</button>
                    `:`
                        <select id="gift-${s}-cost" style="font-size:0.6rem;background:var(--bg3);border:1px solid var(--border);border-radius:4px;padding:0.05rem 0.2rem;" ${$?"disabled":""}>
                            ${y}
                        </select>
                        <button class="btn btn-xs ${$?"btn-secondary":"btn-gold"}" ${$?"disabled":""} onclick="window.useBorrowedGrace('${s}', document.getElementById('gift-${s}-cost').value, '${n}')" style="font-size:0.6rem;">
                            ${$?"✓ Used this scene":"Invoke Borrowed Grace"}
                        </button>
                    `}
                </div>
            </div>
            <div style="font-size:0.55rem;color:var(--text3);margin-top:0.1rem;">
                ${i?"Patron's Gift is an Imbuement: once per scene, touch an item to gain +1 die to a thematic skill and a special benefit. Costs +1 Obligation.":`Borrowed Grace: once per scene, spend 1 Boon or 1 Fatigue, mark +1 Obligation, and gain the Symbol's Gift effect. Works at −1 die if the Symbol is Compromised. Use "🎬 New Scene" above to reset.`}
            </div>
        </div>
    `}function Ur(e,t,r,n,o,i){const a=e.id,s=e.rites||[],c=C(e.name||e.title||a),d=C(e.icon||"🔮"),m=C(e.domain||e.subtitle||""),u=e.color||"var(--gold)",f=o==="invoker",h=n&&n.length>1,y=ve(t,a);if(h&&n.reduce((w,T)=>w+ve(t,T),0),s.length===0)return`
            <div class="rites-patron-block" style="border-left:3px solid ${u};padding-left:0.5rem;background:var(--bg2);border-radius:var(--radius);padding:0.5rem;">
                <div style="display:flex;align-items:center;gap:0.5rem;">
                    <span style="font-size:1.2rem;">${p(d)}</span>
                    <span style="font-weight:600;color:${u};">${p(c)}</span>
                    <span style="font-size:0.7rem;color:var(--text3);">— no rites listed</span>
                </div>
                ${f?`<div style="font-size:0.6rem;color:var(--text3);">Symbol carried. Obligation: ${y}</div>`:""}
            </div>
        `;const b=[...s].sort(Or),$={};b.forEach(w=>{const T=w.tier||"Basic";$[T]||($[T]=[]),$[T].push(w)});let g=`
        <div class="rites-patron-block" style="border-left:3px solid ${u};padding-left:0.5rem;background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;">
            <!-- Header -->
            <div class="rites-header" style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;border-bottom:1px solid var(--border);padding-bottom:0.2rem;margin-bottom:0.2rem;">
                <span style="font-size:1.2rem;">${p(d)}</span>
                <span style="font-weight:600;font-size:1rem;color:${u};">${p(c)}</span>
                ${m?`<span style="font-size:0.7rem;color:var(--text3);">— ${p(m)}</span>`:""}
                <span style="font-size:0.65rem;color:var(--text3);margin-left:auto;">${s.length} rites · Obligation: ${y}</span>
            </div>

            <!-- ─── Obligation Controls ────────────────────────── -->
            <div class="rites-obligation" style="display:flex;gap:0.2rem;align-items:center;font-size:0.75rem;margin-bottom:0.2rem;flex-wrap:wrap;">
                <span style="color:var(--text3);">⛓️ Obligation:</span>
                <span style="font-weight:600;font-size:0.85rem;">${y}</span>
                <button class="btn btn-xs btn-primary" onclick="window.addRiteObligation('${a}', 1, '${t}')">+1</button>
                <button class="btn btn-xs btn-secondary" onclick="window.addRiteObligation('${a}', -1, '${t}')">−1</button>
                <button class="btn btn-xs btn-ghost" onclick="window.clearRiteObligation('${a}', '${t}')" style="color:var(--red);">✕ Clear</button>
                ${f?`
                    <span style="font-size:0.55rem;color:var(--text3);margin-left:0.3rem;">
                        (${h?`Symbol ${n.indexOf(a)+1}/${n.length}`:"Single Symbol"})
                    </span>
                `:""}
                ${f&&h?`
                    <span style="font-size:0.55rem;color:var(--orange);margin-left:0.3rem;">
                        ⚡ Cross-Resonance possible
                    </span>
                `:""}
            </div>

            <!-- ─── Patron Relationship (Runekeeper) ─────────────── -->
            ${!f&&i?`
                <div class="rites-relationship" style="font-size:0.65rem;color:var(--text3);margin-bottom:0.2rem;">
                    <strong>📿 Relationship:</strong> 
                    ${i.patronTier?`Tier ${i.patronTier} · `:""}
                    ${i.patronBond?`${i.patronBond} · `:""}
                    ${i.patronFavor||"Covenant maintained"}
                </div>
            `:""}

            <!-- Rites list -->
            <div class="rites-list" style="display:flex;flex-direction:column;gap:0.3rem;max-height:350px;overflow-y:auto;padding:0.1rem;">
    `;return["Cantrip","Basic","Low","Standard","Advanced","Master","Epic","High"].forEach(w=>{if(!$[w])return;const T=$[w],S=rr(w),x=Wr(w);g+=`
            <div class="rite-tier-group" style="margin-top:0.1rem;">
                <div style="display:flex;align-items:center;gap:0.3rem;font-size:0.7rem;color:${S};font-weight:600;border-bottom:1px solid var(--border);padding-bottom:0.05rem;margin-bottom:0.1rem;">
                    ${x} ${w} (${T.length})
                </div>
        `,T.forEach((z,H)=>{const B=s.indexOf(z);g+=Yr(z,a,B,f,t,i,H===0)}),g+="</div>"}),g+=`
            </div>
        </div>
    `,g}function Yr(e,t,r,n,o,i,a=!1){const s=`${t}-rite-${r}`,c=C(e.name),d=C(e.tier||"Basic"),m=e.xp||e.cost,u=pe(e.xp,0),f=C(e.action||""),h=C(e.range||""),y=C(e.resist||""),b=e.tags||[],$=C(e.materials||""),g=C(e.effect||e.description||""),w=C(e.push_it||""),T=C(e.cost||""),S=C(e.requires||""),x=C(e.invoke||""),z=C(e.duration||""),H=C(e.timer||""),B=!!(g||w||$||T||S||x||z||H||b.length>0),V=rr(d),P=a&&B,I=tt(i,t,c),L=n&&I,R=St(e),N=d.toLowerCase()==="high",le=N?3:2,j=Math.max(R*2,le),pt=N&&!I&&!nr(i,"III"),mt=Tt(i);let Ot="";return B&&(Ot=`
            <div class="rite-details" style="margin-top:0.3rem;padding:0.3rem 0.5rem;background:var(--bg2);border-radius:var(--radius);${P?"":"display:none;"}">
                ${g?`<div class="rite-description" style="margin-bottom:0.2rem;line-height:1.4;font-size:0.85rem;">${K(g)}</div>`:""}
                ${$?`<div class="rite-meta" style="font-size:0.75rem;color:var(--text2);margin-bottom:0.1rem;"><strong>📦 Materials:</strong> ${K($)}</div>`:""}
                ${w?`<div class="rite-meta" style="font-size:0.75rem;color:var(--text2);margin-bottom:0.1rem;"><strong>⚡ Push It:</strong> ${K(w)}</div>`:""}
                <div style="display:flex;flex-wrap:wrap;gap:0.2rem 0.6rem;font-size:0.7rem;color:var(--text3);margin-top:0.1rem;">
                    ${f?`<span><strong>Action:</strong> ${p(f)}</span>`:""}
                    ${h?`<span><strong>Range:</strong> ${p(h)}</span>`:""}
                    ${y?`<span><strong>Resist:</strong> ${p(y)}</span>`:""}
                    ${z?`<span><strong>Duration:</strong> ${p(z)}</span>`:""}
                    ${x?`<span><strong>Invoke:</strong> ${p(x)}</span>`:""}
                    ${S?`<span><strong>Requires:</strong> ${p(S)}</span>`:""}
                    ${T?`<span><strong>Cost:</strong> ${p(T)}</span>`:""}
                    ${H?`<span><strong>Timer:</strong> ${p(H)}</span>`:""}
                </div>
                ${b.length>0?`
                    <div class="rite-tags" style="display:flex;gap:0.15rem;flex-wrap:wrap;margin-top:0.1rem;">
                        ${b.map(Hr=>`<span class="tag-badge" style="display:inline-block;padding:0.05rem 0.3rem;border-radius:6px;background:var(--bg3);border:1px solid var(--border);font-size:0.6rem;color:var(--text3);">${p(C(Hr))}</span>`).join("")}
                    </div>
                `:""}
                <div style="margin-top:0.2rem;display:flex;gap:0.4rem;align-items:center;flex-wrap:wrap;">
                    <button class="btn btn-xs btn-ghost" onclick="window.sendRiteCard('${t}', ${r}, '${o}')" title="Send a formatted reference card to the VTT — no cost, no roll, works whether or not you've learned this rite" style="font-size:0.6rem;">
                        📡
                    </button>
                    ${pt?`
                        <span style="font-size:0.65rem;color:var(--red);" title="High Rites require Tier III or higher">
                            🔒 Requires Tier III (currently Tier ${p(mt)})
                        </span>
                    `:I?`
                        <button class="btn btn-xs btn-gold" onclick="window.invokeRite('${t}', ${r}, '${o}')" title="Invoke this rite normally, paying its listed Obligation cost, and send a card to the VTT">
                            🔮 Invoke (+${R} Obligation)
                        </button>
                        ${L?`
                            <button class="btn btn-xs btn-danger" onclick="window.crackTheSeal('${t}', ${r}, '${o}')" title="Invoke instantly at double the rite's Obligation cost (min +2, or +3 for High Rites)">
                                💥 Crack the Seal
                            </button>
                            <span style="font-size:0.55rem;color:var(--text3);align-self:center;">+${j} Obligation · Instant · Symbol becomes Compromised</span>
                        `:""}
                    `:`
                        <button class="btn btn-xs btn-gold" onclick="window.learnRite('${t}', ${r}, '${o}')" title="Add this Rite to your known Rites for ${u} XP">
                            📖 Learn (${u} XP)
                        </button>
                    `}
                </div>
            </div>
        `),`
        <div class="rite-item ${B?"rite-expandable":""}" data-rite-id="${p(s)}" style="background:var(--bg3);border-radius:var(--radius);padding:0.2rem 0.5rem;border-left:2px solid ${V};margin-bottom:0.1rem;${I?"":"opacity:0.75;"}">
            <div class="rite-header" style="display:flex;justify-content:space-between;align-items:center;cursor:${B?"pointer":"default"};">
                <div style="display:flex;align-items:center;gap:0.3rem;flex-wrap:wrap;">
                    <span class="rite-name" style="font-weight:600;font-size:0.85rem;">${p(c)}</span>
                    ${m?`<span style="font-size:0.65rem;color:var(--text3);">${p(m)} XP</span>`:""}
                    ${I?'<span style="font-size:0.55rem;color:var(--green);">✓ Known</span>':'<span style="font-size:0.55rem;color:var(--text3);">📖 Not learned</span>'}
                </div>
                <div style="display:flex;align-items:center;gap:0.2rem;">
                    ${d?`<span style="font-size:0.55rem;color:${V};font-weight:600;">${p(d)}</span>`:""}
                    ${B?`<span class="rite-expand-icon" style="font-size:0.65rem;color:var(--text3);">${P?"▾":"▸"}</span>`:""}
                </div>
            </div>
            ${Ot}
        </div>
    `}function Xr(e){e.querySelectorAll(".rite-expandable .rite-header").forEach(r=>{r.addEventListener("click",n=>{const o=r.closest(".rite-item");if(!o)return;const i=o.querySelector(".rite-details");if(!i)return;const a=i.style.display!=="none";i.style.display=a?"none":"block";const s=o.querySelector(".rite-expand-icon");s&&(s.textContent=a?"▸":"▾");const c=o.dataset.riteId;if(c){const d=JSON.parse(sessionStorage.getItem("fates-edge-expanded-rites")||"{}");a?delete d[c]:d[c]=!0,sessionStorage.setItem("fates-edge-expanded-rites",JSON.stringify(d))}})});const t=JSON.parse(sessionStorage.getItem("fates-edge-expanded-rites")||"{}");e.querySelectorAll(".rite-item[data-rite-id]").forEach(r=>{const n=r.dataset.riteId;if(t[n]){const o=r.querySelector(".rite-details");o&&(o.style.display="block");const i=r.querySelector(".rite-expand-icon");i&&(i.textContent="▾")}})}window.usePatronGift=async function(e,t){const r=E().characters?.find(d=>d.id===t);if(!r){l("Character not found.","error");return}if(r.magicPath!=="runekeeper"){l("Only Runekeepers can use Patron's Gift.","error");return}if(!(r.learnedTalents||[]).includes("familiar")){l("You need a Familiar (Thiasos) to use Patron's Gift.","error");return}const n=me(E(),e);if(!n){l("Patron not found.","error");return}const o=kt(n);if(!o){l("This patron has no Gift defined.","error");return}const i=ve(r.id,e);Re(r.id,e,i+1),Ae();const a=C(o.name||"Patron's Gift"),s=C(o.effect||"The item glows with patron's favor."),c=`Obligation +1 (now ${i+1})`;l(`✨ ${a}: ${s} (Obligation +1)`,"success"),Ne(ir(a,n.name||n.title||e,n.icon||"🔮",s,c,"Runekeeper — Patron's Gift (Imbuement)")),document.getElementById("spellcraft-content")&&ue(()=>import("./spellcraft.BTrFBpcK.js").then(d=>{d.renderActiveTabContent&&d.renderActiveTabContent()}),[])};window.useBorrowedGrace=async function(e,t,r="default-character"){const n=E().characters?.find(f=>f.id===r);if(!n)return;if(n.magicPath!=="invoker"){l("Only Invokers can use Borrowed Grace.","error");return}if(!(n.symbols||[]).includes(e)){l("You do not carry a Symbol for this patron.","error");return}if(n.sceneFlags&&n.sceneFlags.borrowedGrace){l("Borrowed Grace has already been used this scene. Start a New Scene to use it again.","error");return}const o=(n.compromisedSymbols||[]).includes(e);if(t==="boon"){const f=n.boons||0;if(f<1){l("Not enough Boons! Need 1 Boon.","error");return}n.boons=f-1}else if(t==="fatigue"){const f=n.fatigue||0;if(f>=(n.attributes?.body||1)){l("Fatigue track is full!","error");return}n.fatigue=f+1}else{l("Invalid cost type. Choose boon or fatigue.","error");return}const i=ve(n.id,e);Re(n.id,e,i+1),Ae(),n.sceneFlags||(n.sceneFlags={}),n.sceneFlags.borrowedGrace=!0;const a=me(E(),e);if(!a){l("Patron not found.","error");return}const s=kt(a);if(!s){l("This patron has no Gift defined.","error");return}const c=C(s.name||"Borrowed Grace"),d=C(s.effect||"The Symbol flares with borrowed power."),m=`Cost: 1 ${t}, Obligation +1 (now ${i+1})`,u=o?"⚠️ Symbol is Compromised — this applies at −1 die.":"";l(`🎴 ${c}: ${d}${u?" "+u:""} (Cost: 1 ${t}, Obligation +1)`,"success"),Ne(ir(c,a.name||a.title||e,a.icon||"🔮",d,m,`Invoker — Borrowed Grace${u?" · "+u:""}`)),He(),document.getElementById("spellcraft-content")&&ue(()=>import("./spellcraft.BTrFBpcK.js").then(f=>{f.renderActiveTabContent&&f.renderActiveTabContent()}),[])};window.startNewScene=function(e="default-character"){const t=E(),r=t.characters?.find(n=>n.id===e)||t.characters?.[e];r&&(r.sceneFlags={},He(),l("🎬 New scene — once-per-scene abilities (like Borrowed Grace) are available again.","info"),document.getElementById("spellcraft-content")&&ue(()=>import("./spellcraft.BTrFBpcK.js").then(n=>{n.renderActiveTabContent&&n.renderActiveTabContent()}),[]))};window.learnRite=function(e,t,r="default-character"){const n=E(),o=me(n,e);if(!o){l("Patron not found.","error");return}const i=o.rites?.[t];if(!i){l("Rite not found.","error");return}const a=n.characters?.find(f=>f.id===r)||n.characters?.[r];if(!a){l("Character not found.","error");return}const s=C(i.name);if(a.rites||(a.rites=[]),tt(a,e,s)){l(`"${s}" is already known.`,"info");return}if(C(i.tier||"").toLowerCase()==="high"&&!nr(a,"III")){l(`"${s}" is a High Rite and requires Tier III (you're Tier ${Tt(a)}).`,"error");return}const c=pe(i.xp,0),d=a.totalXp||0,m=a.xpSpent||0,u=d-m;if(c>0&&u<c){l(`Not enough XP. Need ${c}, have ${u} available.`,"error");return}confirm(`Learn "${s}" (${i.tier||""}) for ${c} XP?`)&&(a.rites.push(or(e,s)),a.xpSpent=m+c,He(),l(`📖 Learned "${s}" (${c} XP spent).`,"success"),document.getElementById("spellcraft-content")&&ue(()=>import("./spellcraft.BTrFBpcK.js").then(f=>{f.renderActiveTabContent&&f.renderActiveTabContent()}),[]))};window.invokeRite=function(e,t,r="default-character"){const n=E(),o=me(n,e);if(!o){l("Patron not found.","error");return}const i=o.rites?.[t];if(!i){l("Rite not found.","error");return}const a=C(i.name),s=n.characters?.find(b=>b.id===r)||n.characters?.[r];if(!s||!tt(s,e,a)){l(`You haven't learned "${a}" yet — learn it first.`,"error");return}const c=St(i),d=ve(r,e),m=d+c,u=C(i.action||"");if(!confirm(`Invoke "${a}"${u?` (${u})`:""}?

Cost: +${c} Obligation (total: ${d} → ${m}).`))return;Re(r,e,m),Ae();const f=`Obligation +${c} (now ${m})`,h=C(i.effect||i.description||"The rite resolves."),y=[u,C(i.range||"")].filter(Boolean).join(" · ");l(`📜 "${a}" invoked. Obligation +${c} (now ${m}).`,"success"),Ne(Ct(a,o.name||o.title||e,o.icon||"📜",h,f,y)),document.getElementById("spellcraft-content")&&ue(()=>import("./spellcraft.BTrFBpcK.js").then(b=>{b.renderActiveTabContent&&b.renderActiveTabContent()}),[])};window.sendRiteCard=function(e,t,r="default-character"){const n=me(E(),e);if(!n){l("Patron not found.","error");return}const o=n.rites?.[t];if(!o){l("Rite not found.","error");return}const i=C(o.name),a=C(o.tier||""),s=C(o.effect||o.description||""),c=C(o.action||""),d=C(o.range||""),m=C(o.cost||""),u=[a,c,d].filter(Boolean).join(" · ");Ne(Ct(i,n.name||n.title||e,n.icon||"📜",s,m?`Cost: ${m}`:"",u)),l(`📡 "${i}" sent to VTT as a reference card.`,"success")};window.crackTheSeal=function(e,t,r="default-character"){const n=E(),o=me(n,e);if(!o){l("Patron not found.","error");return}const i=o.rites?.[t];if(!i){l("Rite not found.","error");return}const a=C(i.name),s=n.characters?.find(w=>w.id===r)||n.characters?.[r];if(!s||!tt(s,e,a)){l(`You haven't learned "${a}" yet — learn it first.`,"error");return}const c=C(i.tier||"").toLowerCase()==="high",d=St(i),m=c?3:2,u=Math.max(d*2,m),f=ve(r,e),h=f+u;if(!confirm(`💥 Crack the Seal: invoke "${a}" instantly?

This rite's base cost is ${d} Obligation. Crack the Seal doubles it (minimum +${m}${c?" for High Rites":""}), costing +${u} Obligation this time (total: ${f} → ${h}). The Symbol becomes Compromised.`))return;Re(r,e,h),Ae();const y=E();if(y.characters){const w=y.characters.find(T=>T.id===r)||y.characters[r];w&&(w.compromisedSymbols||(w.compromisedSymbols=[]),w.compromisedSymbols.includes(e)||(w.compromisedSymbols.push(e),He()))}const b=`Obligation +${u} (now ${h}) · Symbol Compromised`,$=C(i.effect||i.description||"The rite resolves instantly."),g=`Crack the Seal — ${c?"High":"Standard"} Rite, instant action.`;l(`💥 "${a}" invoked instantly! Obligation +${u} (now ${h}). Symbol is now Compromised (−1 die on Borrowed Grace until restored).`,"warning"),Ne(Ct(a,o.name||o.title||e,o.icon||"📜",$,b,g)),document.getElementById("spellcraft-content")&&ue(()=>import("./spellcraft.BTrFBpcK.js").then(w=>{w.renderActiveTabContent&&w.renderActiveTabContent()}),[])};window.addRiteObligation=function(e,t=1,r="default-character"){const n=ve(r,e);Re(r,e,Math.max(0,n+t)),Ae(),l(`Obligation ${t>0?"+":""}${t} for ${e}`,t>0?"success":"info"),document.getElementById("spellcraft-content")&&ue(()=>import("./spellcraft.BTrFBpcK.js").then(o=>{o.renderActiveTabContent&&o.renderActiveTabContent()}),[])};window.clearRiteObligation=function(e,t="default-character"){Re(t,e,0),Ae(),l(`Obligation cleared for ${e}`,"info"),document.getElementById("spellcraft-content")&&ue(()=>import("./spellcraft.BTrFBpcK.js").then(r=>{r.renderActiveTabContent&&r.renderActiveTabContent()}),[])};var gt={Burning:"#e67e22",Freezing:"#3498db",Storm:"#f1c40f",Stone:"#7f8c8d",Wave:"#2980b9",Wind:"#ecf0f1",Force:"#e74c3c",Area:"#9b59b6",Strike:"#c0392b",Wall:"#2c3e50",Bind:"#e67e22",Dispel:"#8e44ad",Veil:"#1abc9c",Scry:"#2ecc71",Memory:"#f39c12",Command:"#d35400",Fear:"#c0392b",HEAL:"#27ae60",Purify:"#2ecc71",Strengthen:"#f1c40f",Waken:"#e67e22",Beast:"#d35400",Leap:"#8e44ad",Fold:"#8e44ad",Gate:"#c0392b",Gravity:"#2c3e50",Create:"#f39c12",Summon:"#9b59b6",Transmute:"#e74c3c",Animate:"#e67e22",Sense:"#3498db",Reveal:"#1abc9c",Light:"#f1c40f",Shadow:"#2c3e50",Silence:"#7f8f8d",Protect:"#27ae60",Counter:"#c0392b",Reflect:"#8e44ad",Store:"#d35400",Curse:"#c0392b",Bless:"#27ae60"},Kr={Burning:"Ignite, heat, combustion, smoke",Freezing:"Ice, slowing, brittle shatter, cold",Storm:"Lightning, shock, arc, thunder",Stone:"Walls, spikes, tremors, armor",Wave:"Crushing water, currents, pressure",Wind:"Levitation, gusts, deflection, push/pull",Force:"Kinetic power, shields, blasts, telekinesis",Area:"Cone, circle, corridor, zone effect",Strike:"Single target precision",Wall:"Barrier or blockade",Bind:"Restrain, hold, suspend, entangle",Dispel:"Suppress magic, unravel ongoing effects",Veil:"Conceal, blur, illusion, silence",Scry:"Reveal hidden, see distance, read traces",Memory:"Erase, alter, restore memories",Command:"Compel a short action (one word)",Fear:"Panic, flee, break morale",HEAL:"Close wounds, restore flesh, reduce Harm 1",Purify:"Remove poison, corruption, disease",Strengthen:"Enhance body, armor, senses (temporary)",Waken:"Counter sleep, paralysis, stun",Beast:"Speak with or influence animals",Leap:"Jump far, blink across short space (Near)",Fold:"Short-range teleport, vanish-reappear (Far)",Gate:"Long distance passage, open/close path",Gravity:"Crush, lift, suspend, walk on walls/ceiling",Create:"Manifest mundane matter briefly (1 scene)",Summon:"Call a being or construct",Transmute:"Turn one thing into another (temporary)",Animate:"Make objects act with intent (1 scene)",Sense:"Detect presence of a named tag/element",Reveal:"Unveil hidden, glamoured, or invisible things",Light:"Create illumination (glow, torch-bright)",Shadow:"Deepen darkness, hide edges, obscure",Silence:"Suppress sound in zone or on target",Protect:"Reduce/deflect next harm (Armor 1)",Counter:"Interrupt a casting/ritual in its window",Reflect:"Turn next targeted effect back on its source",Store:"Bank 1-2 successes in a vessel (once)",Curse:"Attach hostile tag/timer to target",Bless:"Grant favourable tag (luck, favor, ward-key)"},rt=[{name:"🔥 Ember Flick",tags:["Burning","Strike"],dv:2,description:"A small bolt of flame strikes a single target. Deal 1 Fatigue or ignite a small object.",category:"Offensive"},{name:"❄️ Frost Grasp",tags:["Freezing","Bind"],dv:2,description:"Ice encases a target's limbs. They suffer -1 die to physical actions until they break free (Body DV 3).",category:"Control"},{name:"🌿 Healing Touch",tags:["HEAL","Strengthen"],dv:2,description:"Close wounds and restore vitality. Target clears 1 Fatigue and gains +1 die on their next physical action.",category:"Support"},{name:"🌀 Telekinetic Push",tags:["Force","Strike"],dv:2,description:"A blast of invisible force knocks a target back one range band. If they hit an obstacle, they suffer Harm 1.",category:"Offensive"},{name:"🌙 Shadow Veil",tags:["Veil","Shadow","Silence"],dv:3,description:"Conceal yourself and nearby allies in moving shadow. Gain +2 dice to Stealth for one scene.",category:"Utility"},{name:"⚡ Storm Bolt",tags:["Storm","Strike","Area"],dv:3,description:"A crackling bolt of lightning arcs through a zone. All targets in the zone must test Body+Athletics (DV 4) or suffer Harm 1.",category:"Offensive"},{name:"🛡️ Aegis",tags:["Protect","Strengthen"],dv:2,description:"A shimmering barrier of force protects you. Gain Armor 1 against the next attack this scene.",category:"Defensive"},{name:"🔮 Scrying Eye",tags:["Scry","Sense","Reveal"],dv:3,description:"Glimpse a distant place or hidden truth. Ask the GM one yes/no question about a location or object you can describe.",category:"Utility"},{name:"💀 Leashed Curse",tags:["Curse","Bind","Fear"],dv:3,description:"A curse that tightens as the target struggles. They suffer -1 die to all actions until they succeed on a Resolve test (DV 4).",category:"Control"},{name:"✨ Momentary Forge",tags:["Create","Transmute","Animate"],dv:3,description:"Shape raw matter into a temporary tool or weapon. Lasts one scene, then crumbles to dust.",category:"Utility"},{name:"🌊 Tidal Wave",tags:["Wave","Area","Force"],dv:3,description:"A surge of water crashes through a zone. All targets must test Body+Athletics (DV 3) or be knocked prone and suffer Harm 1.",category:"Offensive"},{name:"💨 Wind Step",tags:["Wind","Leap"],dv:2,description:"A gust of wind carries you. Move to any unoccupied space within Near range without provoking opportunity attacks.",category:"Movement"},{name:"🔮 Counterspell",tags:["Counter","Dispel"],dv:3,description:"Interrupt a spell being cast within Near range. The caster must test Spirit+Resolve (DV 4) or their spell fails.",category:"Defensive"},{name:"🌿 Verdant Grasp",tags:["Stone","Bind","Area"],dv:3,description:"Roots erupt from the ground in a zone. All targets must test Body+Athletics (DV 3) or become Entangled (-1 die to movement).",category:"Control"},{name:"🔥 Dragon's Breath",tags:["Burning","Area","Force"],dv:4,description:"A cone of flame erupts from your mouth. All targets in Close range must test Body+Athletics (DV 4) or suffer Harm 2 (Burn).",category:"Offensive"},{name:"🧠 Mind Probe",tags:["Scry","Memory","Command"],dv:4,description:"Delve into a target's mind. Learn one surface thought or memory. The target may resist with Resolve (DV 4).",category:"Utility"}],ar=["Offensive","Defensive","Support","Control","Utility","Movement"],Qr={Offensive:"⚔️",Defensive:"🛡️",Support:"💚",Control:"🌀",Utility:"🔍",Movement:"💨"},sr=[{value:"wits",label:"Wits + Arcana"},{value:"spirit",label:"Spirit + Arcana"}];function oe(e){if(e==null)return"";if(typeof e=="string")return e;if(typeof e=="number"||typeof e=="boolean")return String(e);if(Array.isArray(e))return e.map(t=>oe(t)).join(", ");if(typeof e=="object"){if(e.name)return oe(e.name);if(e.label)return oe(e.label);if(e.description)return oe(e.description);if(e.effect)return oe(e.effect);if(e.text)return oe(e.text);try{return JSON.stringify(e)}catch{return"[object]"}}return String(e)}function Jr(e){return e?p(e).replace(/\n/g,"<br>"):""}function lr(e){return gt[e]||"var(--text3)"}function cr(e){return Kr[e]||"Unknown tag"}function nt(e){return Qr[e]||"📜"}function Zr(e){return e.signature?1:0}function G(){return document.querySelector(".spellbook-container")?.parentElement||document.getElementById("spellcraft-content")}function Ut(e,t){if(!t)return null;if(e.patrons?.cosmic){const r=e.patrons.cosmic.find(n=>n.id===t);if(r)return r}if(e.patrons?.terrestrial){const r=e.patrons.terrestrial.find(n=>n.id===t);if(r)return r}if(e.patrons?.religions){for(const r of e.patrons.religions)if(r.orders){const n=r.orders.find(o=>o.id===t);if(n)return{...n,_religion:r.name}}}return null}function en(e){const t=[];if(e.patrons?.cosmic&&t.push(...e.patrons.cosmic),e.patrons?.terrestrial&&t.push(...e.patrons.terrestrial),e.patrons?.religions)for(const r of e.patrons.religions)r.orders&&t.push(...r.orders);return t}function zt(e){const t=e.indexOf("::");return t===-1?{patronId:null,name:e}:{patronId:e.slice(0,t),name:e.slice(t+2)}}function dr(e,t,r){const{patronId:n,name:o}=zt(r);if(n){const a=Ut(e,n),s=a?.rites?.find(c=>c.name===o);if(s)return{...s,patronName:a.name||a.title,patronIcon:a.icon}}const i=[];t.patron&&i.push(t.patron),t.boundPatron&&i.push(t.boundPatron),Array.isArray(t.symbols)&&i.push(...t.symbols);for(const a of i){const s=Ut(e,a),c=s?.rites?.find(d=>d.name===o);if(c)return{...c,patronName:s.name||s.title,patronIcon:s.icon}}for(const a of en(e)){const s=a.rites?.find(c=>c.name===o);if(s)return{...s,patronName:a.name||a.title,patronIcon:a.icon}}return null}function tn(e,t){const r=e.rites||[];if(r.length===0)return"";const n=r.map(o=>{const{name:i}=zt(o);return dr(t,e,o)||{name:i,tier:"",effect:""}});return`
        <div class="grimoire-collection-section" style="background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;border-left:4px solid var(--gold);">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.2rem;">
                <span style="font-weight:600;color:var(--gold);">📜 Rites Known</span>
                <span style="font-size:0.6rem;color:var(--text3);">${n.length} learned · manage new Rites in the Rites panel</span>
            </div>
            <div style="display:flex;flex-direction:column;gap:0.15rem;margin-top:0.2rem;max-height:160px;overflow-y:auto;">
                ${n.map(o=>`
                    <div style="padding:0.15rem 0.3rem;border-bottom:1px solid var(--border);font-size:0.75rem;">
                        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.2rem;">
                            <span style="font-weight:500;">${p(o.name)}</span>
                            <span style="display:flex;gap:0.3rem;align-items:center;">
                                ${o.patronName?`<span style="color:var(--text3);font-size:0.6rem;">${p(o.patronName)}</span>`:""}
                                ${o.tier?`<span style="color:var(--text3);font-size:0.6rem;">${p(o.tier)}</span>`:""}
                            </span>
                        </div>
                        ${o.effect?`<div style="color:var(--text2);font-size:0.7rem;margin-top:0.1rem;">${p(o.effect)}</div>`:""}
                    </div>
                `).join("")}
            </div>
        </div>
    `}function rn(e,t){const r=e.repertoire||[];if(r.length===0)return"";const n=r.map(o=>{const{name:i}=zt(o);return dr(t,e,o)||{name:i,tier:"",effect:""}});return`
        <div class="grimoire-collection-section" style="background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;border-left:4px solid var(--gold);">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.2rem;">
                <span style="font-weight:600;color:var(--gold);">🎶 Repertoire (Songs)</span>
                <span style="font-size:0.6rem;color:var(--text3);">${n.length} learned · manage new Songs in the Cantor panel</span>
            </div>
            <div style="display:flex;flex-direction:column;gap:0.15rem;margin-top:0.2rem;max-height:160px;overflow-y:auto;">
                ${n.map(o=>`
                    <div style="padding:0.15rem 0.3rem;border-bottom:1px solid var(--border);font-size:0.75rem;">
                        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.2rem;">
                            <span style="font-weight:500;">${p(o.name)}</span>
                            <span style="display:flex;gap:0.3rem;align-items:center;">
                                ${o.patronName?`<span style="color:var(--text3);font-size:0.6rem;">${p(o.patronName)}</span>`:""}
                                ${o.tier?`<span style="color:var(--text3);font-size:0.6rem;">${p(o.tier)}</span>`:""}
                            </span>
                        </div>
                        ${o.effect?`<div style="color:var(--text2);font-size:0.7rem;margin-top:0.1rem;">${p(o.effect)}</div>`:""}
                    </div>
                `).join("")}
            </div>
        </div>
    `}var nn=["Favorable","Neutral","Wary","Hostile"];function on(e){const t=(e.learnedTalents||[]).includes("true-name-keeper"),r=e.boundSpirits||[],n=e.spiritRelationships||[];return`
        <div class="grimoire-collection-section" style="background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;border-left:4px solid #8e44ad;">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.2rem;">
                <span style="font-weight:600;color:#8e44ad;">👁️ Spirit Relationships</span>
                ${t?'<button class="btn btn-xs btn-primary" onclick="window.grimoireAddSpiritRelationship()">+ Record Spirit</button>':'<span style="font-size:0.6rem;color:var(--text3);">Unlocks with True Name Keeper (15 XP)</span>'}
            </div>

            ${r.length>0?`
                <div style="margin-top:0.25rem;">
                    <div style="font-size:0.6rem;color:var(--text3);font-weight:600;">Currently Bound (this scene)</div>
                    ${r.map(o=>`
                        <div style="display:flex;justify-content:space-between;font-size:0.75rem;padding:0.1rem 0.3rem;border-bottom:1px solid var(--border);">
                            <span>${p(o.name)} <span style="color:var(--text3);font-size:0.6rem;">Cap ${o.cap||1}</span></span>
                            <span style="color:var(--text3);font-size:0.6rem;">${p(o.nature||"")}</span>
                        </div>
                    `).join("")}
                    <div style="font-size:0.55rem;color:var(--text3);margin-top:0.1rem;">Manage active bindings and the Leash in the Summoning panel.</div>
                </div>
            `:""}

            ${t?`
                <div style="margin-top:0.3rem;">
                    <div style="font-size:0.6rem;color:var(--text3);font-weight:600;">Known by True Name</div>
                    ${n.length===0?`
                        <div style="font-size:0.7rem;color:var(--text3);padding:0.3rem 0;">No spirits recorded yet. Once you've encountered one worth remembering, record it here.</div>
                    `:n.map(o=>`
                        <div style="padding:0.25rem 0.3rem;border-bottom:1px solid var(--border);font-size:0.75rem;">
                            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.3rem;">
                                <span style="font-weight:600;">${p(o.name)}</span>
                                ${o.trueName?`<span style="color:var(--gold);font-size:0.65rem;font-style:italic;">"${p(o.trueName)}"</span>`:""}
                                <select onchange="window.grimoireSetSpiritDisposition('${o.id}', this.value)" style="font-size:0.6rem;background:var(--bg3);border:1px solid var(--border);border-radius:4px;">
                                    ${nn.map(i=>`<option value="${i}" ${o.disposition===i?"selected":""}>${i}</option>`).join("")}
                                </select>
                            </div>
                            ${o.nature?`<div style="color:var(--text2);font-size:0.7rem;margin-top:0.1rem;">${p(o.nature)}</div>`:""}
                            ${o.notes?`<div style="color:var(--text3);font-size:0.65rem;font-style:italic;">${p(o.notes)}</div>`:""}
                            <div style="font-size:0.6rem;color:var(--text3);">Called ${o.timesBound||0} time${(o.timesBound||0)===1?"":"s"}</div>
                            <div style="display:flex;gap:0.2rem;margin-top:0.15rem;">
                                <button class="btn btn-xs btn-gold" onclick="window.grimoireRecallSpirit('${o.id}')" title="Call by true name — Leash Capacity −2 for this binding, per True Name Keeper">👁️ Call by True Name</button>
                                <button class="btn btn-xs btn-ghost" onclick="window.grimoireEditSpiritRelationship('${o.id}')" title="Edit">✏️</button>
                                <button class="btn btn-xs btn-ghost" onclick="window.grimoireDeleteSpiritRelationship('${o.id}')" style="color:var(--red);" title="Remove">✕</button>
                            </div>
                        </div>
                    `).join("")}
                </div>
            `:`
                <div style="font-size:0.65rem;color:var(--text3);margin-top:0.3rem;">
                    Learn True Name Keeper (15 XP) to call any previously encountered spirit by true name (Leash Capacity −2) — this is where you'd track those relationships once you have.
                </div>
            `}
        </div>
    `}function an(e,t){const r=(e.rites||[]).length>0||e.magicPath==="runekeeper"||e.magicPath==="invoker",n=(e.repertoire||[]).length>0||e.magicPath==="cantor",o=(e.boundSpirits||[]).length>0||(e.spiritRelationships||[]).length>0||e.magicPath==="summoner"||(e.learnedTalents||[]).includes("true-name-keeper");if(!r&&!n&&!o)return"";let i='<div class="grimoire-collection" style="display:flex;flex-direction:column;gap:0.4rem;margin-bottom:0.2rem;">';return r&&(i+=tn(e,t)),n&&(i+=rn(e,t)),o&&(i+=on(e)),i+="</div>",i}function sn(e,t){const r=oe(e.name||"Unnamed Spell"),n=e.tags||[],o=e.dv||1,i=oe(e.effect||e.description||""),a=e.category||"Utility",s=!!e.signature,c=(e.cost||{}).obligation||0,d=t.wits||1,m=t.spirit||1,u=t.skills?.arcana||0,f=t.magicPath||"none",h=s?1:0,y=d+u+h,b=m+u+h,$=1+n.length,g=n.map(x=>{const z=lr(x),H=cr(x);return`<span style="display:inline-block;padding:0.05rem 0.4rem;margin:0.05rem;border-radius:8px;background:${z}22;border:1px solid ${z};font-size:0.6rem;color:${z};cursor:help;" title="${p(H)}">${p(x)}</span>`}).join(" ");let w="",T="";if(f==="free-caster")w=`
            <div style="background:var(--bg3);padding:0.3rem 0.5rem;border-radius:6px;font-size:0.7rem;color:var(--text2);margin-top:0.2rem;">
                <strong>Recommended DV:</strong> ${$} (1 + ${n.length} tag${n.length>1?"s":""})
                ${s?"<br>⭐ <strong>Signature:</strong> +1 die":""}
                <br><strong>Roll options:</strong>
                <ul style="margin:0.1rem 0;padding-left:1rem;">
                    <li><strong>Wits + Arcana:</strong> ${y}d vs DV ${o}</li>
                    <li><strong>Spirit + Arcana:</strong> ${b}d vs DV ${o}</li>
                </ul>
            </div>
        `,T=`
            <div style="display:flex;gap:0.3rem;margin-top:0.3rem;flex-wrap:wrap;">
                <button class="btn btn-xs btn-gold spell-cast-from-vtt" data-spell-id="${e.id}" data-attr="wits">🔮 Cast with Wits</button>
                <button class="btn btn-xs btn-gold spell-cast-from-vtt" data-spell-id="${e.id}" data-attr="spirit">🔮 Cast with Spirit</button>
            </div>
        `;else{let x="",z="";if(f==="runekeeper"||f==="invoker"){const H=t.patron||"None";x="Patron",z=H,t.obligation>0&&(z+=` · Obligation: ${t.obligation}`)}else f==="cantor"?(x="Cantor",z=`Corruption ${t.corruption||0} · Bloom ${t.bloomCount||0} · Resonant Rites ${(t.resonantRites||[]).length}`):f==="psion"?(x="Psion",z=`Mental Strain ${t.mentalStrain||0}`):f==="summoner"?(x="Summoner",z=`Leash ${t.leash||0}/${(t.spirit||2)+(t.presence||2)}`):(x="Magic Path",z=f||"None");z&&(w=`
                <div style="background:var(--bg3);padding:0.2rem 0.5rem;border-radius:6px;font-size:0.65rem;color:var(--text2);margin-top:0.2rem;">
                    <strong>${x}:</strong> ${p(z)}
                </div>
            `),T=`
            <div style="margin-top:0.3rem;font-size:0.65rem;color:var(--text3);">
                ⚠️ Only Free Casters can cast from the grimoire.
            </div>
        `}let S="";return c>0&&(S=`<span style="background:var(--bg3);padding:0.05rem 0.4rem;border-radius:8px;font-size:0.6rem;color:var(--text3);">⛓️ Obligation ${c}</span>`),`
        <div style="
            background:var(--bg2);
            border-radius:var(--radius);
            padding:0.5rem 0.8rem;
            border:1px solid var(--border);
            border-left:4px solid ${s?"var(--gold)":"var(--text3)"};
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            max-width: 450px;
            margin:0.1rem 0;
            font-family: inherit;
        ">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.2rem;">
                <div style="display:flex;align-items:center;gap:0.3rem;flex-wrap:wrap;">
                    ${s?'<span style="color:var(--gold);font-size:1rem;">⭐</span>':""}
                    <span style="font-weight:700;font-size:1.05rem;color:${s?"var(--gold)":"var(--text)"};">${p(r)}</span>
                    <span style="font-size:0.7rem;color:var(--text3);background:var(--bg3);padding:0.05rem 0.4rem;border-radius:8px;">DV ${o}</span>
                    ${S}
                </div>
                <span style="font-size:0.65rem;color:var(--text3);">${nt(a)} ${a}</span>
            </div>

            <div style="font-size:0.75rem;color:var(--text2);margin-top:0.1rem;">
                <strong>Caster:</strong> ${p(t.name||"Unknown")}
            </div>

            ${n.length>0?`<div style="display:flex;flex-wrap:wrap;gap:0.1rem;margin-top:0.1rem;">${g}</div>`:""}

            ${i?`<div style="font-size:0.8rem;color:var(--text);margin-top:0.2rem;line-height:1.4;padding-left:0.1rem;">${p(i)}</div>`:""}

            ${w}

            ${T}
        </div>
    `}async function D(e){if(!e){console.warn("[Spellbook] renderSpellbook called with no container element — skipping.");return}const t=v();if(!t){e.innerHTML=`
            <div class="spellbook-empty" style="text-align:center;color:var(--text3);padding:2rem 0;">
                <div style="font-size:2rem;">📖</div>
                <p>Select a character to view their spellbook.</p>
            </div>
        `;return}try{await De.loadPatronData()}catch(x){console.warn("[Spellbook] Failed to load patron data for Grimoire Collection:",x)}const r=E();t.spellbook||(t.spellbook=[],k({spellbook:t.spellbook}));const n=t.spellbook,o=localStorage.getItem("fates-edge-spellbook-sort")||"name",i=localStorage.getItem("fates-edge-spellbook-filter-tag")||"",a=localStorage.getItem("fates-edge-spellbook-filter-signature")==="true",s=localStorage.getItem("fates-edge-spellbook-filter-text")||"";let c=[...n];if(i&&(c=c.filter(x=>(x.tags||[]).includes(i))),a&&(c=c.filter(x=>x.signature)),s){const x=s.toLowerCase();c=c.filter(z=>(z.name||"").toLowerCase().includes(x)||(z.description||"").toLowerCase().includes(x)||(z.tags||[]).some(H=>H.toLowerCase().includes(x)))}const d=cn(c,o),m=n.filter(x=>x.signature).length,u=(t.magicPath||"none")==="free-caster",f=n.reduce((x,z)=>x+(z.usage||0),0),h=n.reduce((x,z)=>x+(z._successes||0),0),y=f>0?Math.round(h/f*100):0,b=new Set;n.forEach(x=>(x.tags||[]).forEach(z=>b.add(z)));const $=Array.from(b).sort(),g=rt.map((x,z)=>`<option value="${z}">${x.name} (DV ${x.dv}) — ${x.category}</option>`).join(""),w=ar.map(x=>`<option value="${x}">${nt(x)} ${x}</option>`).join(""),T=sr.map(x=>`<option value="${x.value}">${x.label}</option>`).join("");let S=`
        <div class="spellbook-container" style="display:flex;flex-direction:column;gap:0.5rem;">

            <!-- ─── Header ─────────────────────────────────────── -->
            <div class="spellbook-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.3rem;border-bottom:2px solid var(--border);padding-bottom:0.3rem;background:linear-gradient(135deg, var(--bg2) 0%, var(--bg1) 100%);border-radius:var(--radius) var(--radius) 0 0;padding:0.3rem 0.8rem;">
                <div style="display:flex;align-items:center;gap:0.4rem;">
                    <span style="font-size:1.4rem;">📖</span>
                    <div>
                        <span style="font-weight:600;font-size:1.05rem;color:var(--gold);">Grimoire</span>
                        <span style="font-size:0.7rem;color:var(--text3);margin-left:0.3rem;">${n.length} spells</span>
                    </div>
                </div>
                <div style="display:flex;gap:0.3rem;flex-wrap:wrap;align-items:center;">
                    <span style="font-size:0.65rem;color:var(--text3);">⭐ ${m} sig.</span>
                    ${f>0?`<span style="font-size:0.65rem;color:var(--text3);">🎯 ${y}%</span>`:""}
                    <button class="btn btn-sm btn-primary" onclick="window.spellbookAddSpell()">➕ Add</button>
                    ${u?'<button class="btn btn-sm btn-gold" onclick="window.spellbookFromTags()">🔮 From Tags</button>':""}
                    <button class="btn btn-sm btn-secondary" onclick="window.spellbookTemplates()">📋 Templates</button>
                    <button class="btn btn-sm btn-secondary" onclick="window.spellbookImport()">📥 Import</button>
                    <button class="btn btn-sm btn-secondary" onclick="window.spellbookExport()">📤 Export</button>
                    <button class="btn btn-sm btn-ghost" onclick="window.spellbookClearAll()" style="color:var(--red);" title="Clear all spells">🗑️</button>
                </div>
            </div>

            <!-- ─── Grimoire Collection (Rites/Repertoire/Spirits) ─ -->
            ${an(t,r)}

            <!-- ─── Stats Bar ───────────────────────────────────── -->
            <div class="spellbook-stats" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:0.2rem;background:var(--bg2);border-radius:var(--radius);padding:0.2rem 0.5rem;border:1px solid var(--border);font-size:0.7rem;color:var(--text2);">
                <div><strong>Total:</strong> ${n.length}</div>
                <div><strong>Signature:</strong> ${m}</div>
                <div><strong>Casts:</strong> ${f}</div>
                <div><strong>Success:</strong> ${h}</div>
                ${f>0?`<div><strong>Rate:</strong> ${y}%</div>`:""}
            </div>

            <!-- ─── Controls ────────────────────────────────────── -->
            <div class="spellbook-controls" style="display:flex;gap:0.3rem;align-items:center;font-size:0.8rem;flex-wrap:wrap;background:var(--bg2);border-radius:var(--radius);padding:0.2rem 0.4rem;border:1px solid var(--border);">
                <span style="color:var(--text3);font-size:0.7rem;">Sort:</span>
                <select id="spellbook-sort-select" style="background:var(--bg3);color:var(--text);border:1px solid var(--border);border-radius:4px;padding:0.1rem 0.3rem;font-size:0.7rem;">
                    <option value="name" ${o==="name"?"selected":""}>Name</option>
                    <option value="dv" ${o==="dv"?"selected":""}>DV</option>
                    <option value="recent" ${o==="recent"?"selected":""}>Recent</option>
                    <option value="usage" ${o==="usage"?"selected":""}>Usage</option>
                    <option value="success" ${o==="success"?"selected":""}>Success Rate</option>
                </select>

                <span style="color:var(--text3);font-size:0.7rem;margin-left:0.3rem;">Filter:</span>
                <select id="spellbook-filter-tag" style="background:var(--bg3);color:var(--text);border:1px solid var(--border);border-radius:4px;padding:0.1rem 0.3rem;font-size:0.7rem;max-width:120px;">
                    <option value="">All Tags</option>
                    ${$.map(x=>`<option value="${p(x)}" ${x===i?"selected":""}>${p(x)}</option>`).join("")}
                </select>

                <label style="font-size:0.7rem;display:flex;align-items:center;gap:0.2rem;">
                    <input type="checkbox" id="spellbook-filter-signature" ${a?"checked":""} /> ⭐ Signature
                </label>

                <input type="text" id="spellbook-filter-text" value="${p(s)}" placeholder="Search..." style="background:var(--bg3);color:var(--text);border:1px solid var(--border);border-radius:4px;padding:0.1rem 0.3rem;font-size:0.7rem;flex:1;min-width:100px;" />

                <button class="btn btn-xs btn-ghost" onclick="window.spellbookClearFilters()" style="color:var(--text3);font-size:0.6rem;">✕ Clear</button>
            </div>

            <!-- ─── Spell List ──────────────────────────────────── -->
            <div class="spellbook-list" style="display:flex;flex-direction:column;gap:0.3rem;max-height:450px;overflow-y:auto;padding:0.1rem;">
    `;d.length===0?S+=`
            <div class="spellbook-empty" style="text-align:center;color:var(--text3);padding:1.5rem 0;background:var(--bg2);border-radius:var(--radius);border:1px dashed var(--border);">
                <div style="font-size:3rem;">📖</div>
                <p style="font-weight:500;color:var(--text2);">No spells found.</p>
                <p style="font-size:0.85rem;">${n.length===0?"Create your first spell using the Add button.":"Try adjusting your filters."}</p>
                <p style="font-size:0.75rem;color:var(--text3);font-style:italic;">"The Weave does not reward empty pages." – Lysandra</p>
                ${n.length===0?`
                    <div style="display:flex;gap:0.3rem;justify-content:center;margin-top:0.3rem;flex-wrap:wrap;">
                        <button class="btn btn-sm btn-primary" onclick="window.spellbookAddSpell()">➕ Add Spell</button>
                        <button class="btn btn-sm btn-gold" onclick="window.spellbookTemplates()">📋 Load Template</button>
                    </div>
                `:""}
            </div>
        `:d.forEach((x,z)=>{S+=ln(x,z)}),S+=`
            </div>

            <!-- ─── Footer ──────────────────────────────────────── -->
            <div class="spellbook-footer" style="display:flex;justify-content:space-between;font-size:0.6rem;color:var(--text3);border-top:1px solid var(--border);padding-top:0.2rem;">
                <span>${d.length} of ${n.length} spells shown</span>
                <span>${u?"🔮 Free Caster — Can cast":"📜 Study Only — Need Free Caster to cast"}</span>
            </div>

            <!-- ─── Hidden template loader (dropdown + button) ── -->
            <div style="display:none;" id="spellbook-template-loader">
                <select id="spellbook-template-select" style="background:var(--bg3);color:var(--text);border:1px solid var(--border);border-radius:4px;padding:0.1rem 0.3rem;font-size:0.75rem;">
                    ${g}
                </select>
                <button class="btn btn-xs btn-gold" onclick="window.spellbookLoadTemplateFromSelect()">Load</button>
            </div>

            <!-- ─── Hidden category selector for forms ────────── -->
            <div style="display:none;" id="spellbook-category-selector">
                <select id="spellbook-category-select" style="background:var(--bg3);color:var(--text);border:1px solid var(--border);border-radius:4px;padding:0.1rem 0.3rem;font-size:0.75rem;">
                    ${w}
                </select>
            </div>

            <!-- ─── Hidden attribute selector for casting ────── -->
            <div style="display:none;" id="spellbook-attribute-selector">
                <select id="spellbook-attribute-select" style="background:var(--bg3);color:var(--text);border:1px solid var(--border);border-radius:4px;padding:0.1rem 0.3rem;font-size:0.75rem;">
                    ${T}
                </select>
            </div>

        </div>
    `,e.innerHTML=S,dn(e),n.length===0&&!localStorage.getItem("fates-edge-spellbook-tutorial-shown")&&setTimeout(()=>{ke(`
                <div style="display:flex;flex-direction:column;gap:0.3rem;">
                    <div style="font-weight:600;font-size:1.1rem;color:var(--gold);">📖 Welcome to Your Grimoire</div>
                    <p style="font-size:0.85rem;color:var(--text2);">
                        Record your spells here. Each spell has a <strong>name</strong>, <strong>tags</strong>, 
                        and a <strong>DV</strong> (difficulty).
                    </p>
                    <p style="font-size:0.85rem;color:var(--text2);">
                        ⭐ <strong>Signature</strong> spells get +1 die when cast.
                    </p>
                    <p style="font-size:0.85rem;color:var(--text2);">
                        📋 Use <strong>Templates</strong> for inspiration, or build your own with the <strong>Add</strong> button.
                    </p>
                    <p style="font-size:0.75rem;color:var(--text3);font-style:italic;">
                        "The Weave respects repetition. Record your spells."
                    </p>
                    <button class="btn btn-sm btn-secondary" onclick="this.closest('.custom-toast-modal').remove(); localStorage.setItem('fates-edge-spellbook-tutorial-shown', 'true');">Got it!</button>
                </div>
            `,"info")},500)}function ln(e,t){const r=e.id,n=oe(e.name||"Unnamed Spell"),o=e.tags||[],i=e.dv||0,a=oe(e.effect||e.description||""),s=e.signature||!1,c=e.usage||0,d=e._successes||0,m=e.cost||{},u=e.category||"Utility",f=e.source||"custom",h=s?"+1 die":"",y=c>0?Math.round(d/c*100):0,b=o.map(w=>{const T=lr(w),S=cr(w);return`<span class="tag-badge" style="display:inline-block;padding:0.05rem 0.4rem;margin:0.05rem;border-radius:8px;background:${T}22;border:1px solid ${T};font-size:0.6rem;color:${T};cursor:help;" title="${p(S)}">${p(w)}</span>`}).join(" "),$=m.obligation?`⛓️ ${m.obligation}`:m.xp?`${m.xp} XP`:"",g={custom:"✏️ Custom","tags-calculator":"🔮 Calculator",template:"📋 Template",imported:"📥 Imported"}[f]||"📜";return`
        <div class="spell-item" data-spell-id="${p(r)}" style="background:var(--bg3);border-radius:var(--radius);padding:0.3rem 0.5rem;border-left:3px solid ${s?"var(--gold)":"var(--border)"};${s?"border-right:2px solid var(--gold);":""}">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.2rem;">
                <div style="display:flex;align-items:center;gap:0.3rem;flex-wrap:wrap;min-width:0;">
                    ${s?'<span style="color:var(--gold);font-size:0.9rem;" title="Signature spell: +1 die when cast">⭐</span>':""}
                    <span style="font-weight:600;font-size:0.9rem;color:${s?"var(--gold)":"var(--text)"};">${p(n)}</span>
                    ${i?`<span style="font-size:0.7rem;color:var(--text3);font-weight:500;">DV ${i}</span>`:""}
                    ${h?'<span style="font-size:0.55rem;color:var(--gold);background:rgba(212,175,55,0.15);padding:0.05rem 0.3rem;border-radius:8px;">+1 die</span>':""}
                    ${u?`<span style="font-size:0.5rem;color:var(--text3);background:var(--bg2);padding:0.05rem 0.3rem;border-radius:6px;">${nt(u)} ${u}</span>`:""}
                    <span style="font-size:0.5rem;color:var(--text3);background:var(--bg2);padding:0.05rem 0.3rem;border-radius:6px;">${g}</span>
                </div>
                <div style="display:flex;gap:0.2rem;align-items:center;flex-wrap:wrap;">
                    ${c>0?`<span style="font-size:0.6rem;color:var(--text2);">cast ${c}x ${y>0?`· ${y}%`:""}</span>`:""}
                    ${$?`<span style="font-size:0.55rem;color:var(--text3);">${p($)}</span>`:""}
                    <button class="btn btn-xs btn-gold" onclick="window.spellbookUse('${p(r)}')" title="Cast this spell" style="font-size:0.6rem;padding:0.05rem 0.3rem;">🔮 Cast</button>
                    <button class="btn btn-xs btn-ghost" onclick="window.spellbookSendToVTT('${p(r)}')" title="Send a formatted Spell Card to the connected VTT" style="font-size:0.6rem;">📡</button>
                    <button class="btn btn-xs btn-ghost" onclick="window.spellbookToggleSignature('${p(r)}')" title="${s?"Remove signature":"Mark as signature (gives +1 die)"}" style="color:${s?"var(--gold)":"var(--text3)"};font-size:0.6rem;">⭐</button>
                    <button class="btn btn-xs btn-ghost" onclick="window.spellbookCopySpell('${p(r)}')" title="Copy this spell" style="font-size:0.6rem;">📋</button>
                    <button class="btn btn-xs btn-ghost" onclick="window.spellbookEdit('${p(r)}')" title="Edit" style="font-size:0.6rem;">✏️</button>
                    <button class="btn btn-xs btn-ghost" onclick="window.spellbookDelete('${p(r)}')" title="Delete" style="color:var(--red);font-size:0.6rem;">✕</button>
                </div>
            </div>
            ${a?`<div style="font-size:0.75rem;color:var(--text2);margin-top:0.1rem;line-height:1.4;padding-left:0.1rem;">${Jr(a)}</div>`:""}
            ${o.length>0?`<div style="display:flex;flex-wrap:wrap;gap:0.1rem;margin-top:0.1rem;">${b}</div>`:""}
        </div>
    `}function cn(e,t){const r=[...e];switch(t){case"name":r.sort((n,o)=>(n.name||"").localeCompare(o.name||""));break;case"dv":r.sort((n,o)=>(n.dv||0)-(o.dv||0));break;case"recent":r.sort((n,o)=>(o.updatedAt||0)-(n.updatedAt||0));break;case"usage":r.sort((n,o)=>(o.usage||0)-(n.usage||0));break;case"success":r.sort((n,o)=>{const i=(n.usage||0)>0?(n._successes||0)/(n.usage||1):0;return((o.usage||0)>0?(o._successes||0)/(o.usage||1):0)-i});break;default:r.sort((n,o)=>(n.name||"").localeCompare(o.name||""))}return r}function dn(e){const t=e.querySelector("#spellbook-sort-select");t&&t.addEventListener("change",i=>{localStorage.setItem("fates-edge-spellbook-sort",i.target.value),D(e)});const r=e.querySelector("#spellbook-filter-tag");r&&r.addEventListener("change",i=>{localStorage.setItem("fates-edge-spellbook-filter-tag",i.target.value),D(e)});const n=e.querySelector("#spellbook-filter-signature");n&&n.addEventListener("change",i=>{localStorage.setItem("fates-edge-spellbook-filter-signature",String(i.target.checked)),D(e)});const o=e.querySelector("#spellbook-filter-text");if(o){let i;o.addEventListener("input",a=>{clearTimeout(i),i=setTimeout(()=>{localStorage.setItem("fates-edge-spellbook-filter-text",a.target.value),D(e)},300)})}}window.spellbookAddSpell=async function(){const e=v();if(!e)return;const t=prompt("Spell name:");if(!t)return;const r=prompt("Description / Effect:")||"",n=prompt("Tags (space-separated, e.g., Burning Strike Area):")||"",o=n.trim()?n.split(/\s+/):[],i=pe(prompt("DV (difficulty, default 2):")||"2",2),a=await window.spellbookPromptCategory("Category:","Utility");if(a===null)return;const s=pe(prompt("Obligation cost (if any):")||"0",0),c={id:Y("spell_"),name:t.trim(),description:r.trim(),tags:o.map(d=>d.toUpperCase()),dv:Math.max(1,i),cost:{},category:a||"Utility",signature:!1,usage:0,_successes:0,createdAt:Date.now(),updatedAt:Date.now(),source:"custom"};s>0&&(c.cost.obligation=s),e.spellbook||(e.spellbook=[]),e.spellbook.push(c),k({spellbook:e.spellbook}),l(`✨ "${t}" added to spellbook (DV ${i}).`,"success"),D(G())};window.spellbookFromTags=async function(){const e=v();if(!e)return;const t=prompt("Enter TAGS (space-separated, e.g., Burning Strike Area):");if(!t)return;const r=t.trim().split(/\s+/).map(m=>m.toUpperCase()),n=r.filter(m=>gt[m]),o=r.filter(m=>!gt[m]);o.length>0&&l(`Unknown tags: ${o.join(", ")}. They will be included but have no color.`,"warning");const i=1+n.length,a=prompt("Spell name:",n.join(" ")||"New Spell");if(!a)return;const s=prompt("Description / Effect:")||"",c=await window.spellbookPromptCategory("Category:","Utility");if(c===null)return;const d={id:Y("spell_"),name:a.trim(),description:s.trim(),tags:r,dv:Math.max(1,i),cost:{},category:c||"Utility",signature:!1,usage:0,_successes:0,createdAt:Date.now(),updatedAt:Date.now(),source:"tags-calculator"};e.spellbook||(e.spellbook=[]),e.spellbook.push(d),k({spellbook:e.spellbook}),l(`🔮 "${a}" created from tags (DV ${i}).`,"success"),D(G())};window.spellbookTemplates=function(){if(document.getElementById("spellbook-template-select"))window.spellbookLoadTemplateFromSelect();else{if(!v())return;ke(`
            <div style="display:flex;flex-direction:column;gap:0.5rem;">
                <p style="font-weight:600;">📋 Choose a template:</p>
                <select id="template-prompt-select" style="padding:0.3rem;border-radius:var(--radius);background:var(--bg2);color:var(--text);border:1px solid var(--border);">
                    ${rt.map((e,t)=>`<option value="${t}">${e.name} (DV ${e.dv}) — ${e.category}</option>`).join("")}
                </select>
                <div style="display:flex;gap:0.5rem;">
                    <button class="btn btn-primary" id="template-prompt-confirm">Load</button>
                    <button class="btn btn-secondary" id="template-prompt-cancel">Cancel</button>
                </div>
            </div>
        `,"info"),setTimeout(()=>{const e=document.getElementById("template-prompt-confirm"),t=document.getElementById("template-prompt-cancel"),r=document.getElementById("template-prompt-select");e&&e.addEventListener("click",()=>{const n=parseInt(r.value);window.spellbookLoadTemplateByIndex(n);const o=document.querySelector(".custom-toast-modal");o&&o.remove()}),t&&t.addEventListener("click",()=>{const n=document.querySelector(".custom-toast-modal");n&&n.remove()})},100)}};window.spellbookLoadTemplateFromSelect=function(){const e=document.getElementById("spellbook-template-select");if(!e){l("Template dropdown not found. Please refresh.","error");return}const t=parseInt(e.value);if(isNaN(t)||t<0||t>=rt.length){l("Invalid template selection.","error");return}window.spellbookLoadTemplateByIndex(t)};window.spellbookLoadTemplateByIndex=function(e){const t=v();if(!t)return;const r=rt[e],n={id:Y("spell_"),name:r.name,description:r.description,tags:r.tags||[],dv:r.dv||2,cost:{},category:r.category||"Utility",signature:!1,usage:0,_successes:0,createdAt:Date.now(),updatedAt:Date.now(),source:"template"};t.spellbook||(t.spellbook=[]),t.spellbook.push(n),k({spellbook:t.spellbook}),l(`📋 Template "${r.name}" added to spellbook.`,"success"),D(G())};window.spellbookPromptCategory=function(e,t="Utility"){return new Promise(r=>{ke(`
            <div style="display:flex;flex-direction:column;gap:0.5rem;">
                <p style="font-weight:600;">${p(e)}</p>
                <select id="category-prompt-select" style="padding:0.3rem;border-radius:var(--radius);background:var(--bg2);color:var(--text);border:1px solid var(--border);">
                    ${ar.map(n=>`<option value="${n}" ${n===t?"selected":""}>${nt(n)} ${n}</option>`).join("")}
                </select>
                <div style="display:flex;gap:0.5rem;">
                    <button class="btn btn-primary" id="category-prompt-confirm">OK</button>
                    <button class="btn btn-secondary" id="category-prompt-cancel">Cancel</button>
                </div>
            </div>
        `,"info"),setTimeout(()=>{const n=document.getElementById("category-prompt-confirm"),o=document.getElementById("category-prompt-cancel"),i=document.getElementById("category-prompt-select");n&&n.addEventListener("click",()=>{const a=i.value,s=document.querySelector(".custom-toast-modal");s&&s.remove(),r(a)}),o&&o.addEventListener("click",()=>{const a=document.querySelector(".custom-toast-modal");a&&a.remove(),r(null)})},100)})};window.spellbookCopySpell=function(e){const t=v();if(!t)return;const r=t.spellbook.find(o=>o.id===e);if(!r)return l("Spell not found.","error");const n={...r,id:Y("spell_"),name:`${r.name} (copy)`,signature:!1,usage:0,_successes:0,createdAt:Date.now(),updatedAt:Date.now()};t.spellbook.push(n),k({spellbook:t.spellbook}),l(`📋 "${r.name}" copied.`,"success"),D(G())};window.spellbookEdit=async function(e){const t=v();if(!t)return;const r=t.spellbook.find(m=>m.id===e);if(!r)return l("Spell not found.","error");const n=prompt("Spell name:",r.name);if(n===null)return;const o=prompt("Description:",r.description||"")||"",i=prompt("Tags (space-separated):",(r.tags||[]).join(" "))||"",a=i.trim()?i.split(/\s+/):[],s=pe(prompt("DV:",r.dv||2),2),c=await window.spellbookPromptCategory("Category:",r.category||"Utility");if(c===null)return;const d=pe(prompt("Obligation cost:",r.cost?.obligation||0),0);r.name=n.trim(),r.description=o.trim(),r.tags=a.map(m=>m.toUpperCase()),r.dv=Math.max(1,s),r.category=c||"Utility",d>0?r.cost={obligation:d}:r.cost&&(delete r.cost.obligation,Object.keys(r.cost).length===0&&delete r.cost),r.updatedAt=Date.now(),k({spellbook:t.spellbook}),l("Spell updated.","success"),D(G())};window.spellbookDelete=function(e){const t=v();if(!t)return;const r=t.spellbook.find(n=>n.id===e);r&&confirm(`Delete spell "${r.name}"?`)&&(t.spellbook=t.spellbook.filter(n=>n.id!==e),k({spellbook:t.spellbook}),l(`Deleted "${r.name}"`,"info"),D(G()))};window.spellbookClearAll=function(){const e=v();if(e){if(!e.spellbook||e.spellbook.length===0){l("Spellbook is already empty.","info");return}confirm("Delete ALL spells from your spellbook?")&&(e.spellbook=[],k({spellbook:e.spellbook}),l("Spellbook cleared.","info"),D(G()))}};window.spellbookToggleSignature=function(e){const t=v();if(!t)return;const r=t.spellbook.find(n=>n.id===e);r&&(r.signature=!r.signature,r.updatedAt=Date.now(),k({spellbook:t.spellbook}),l(r.signature?`⭐ "${r.name}" is now signature (+1 die).`:`"${r.name}" is no longer signature.`,"info"),D(G()))};window.spellbookClearFilters=function(){localStorage.removeItem("fates-edge-spellbook-filter-tag"),localStorage.removeItem("fates-edge-spellbook-filter-signature"),localStorage.removeItem("fates-edge-spellbook-filter-text");const e=G();e&&D(e)};window.spellbookSendToVTT=function(e){const t=v();if(!t){l("No character selected.","error");return}const r=t.spellbook?.find(o=>o.id===e);if(!r){l("Spell not found.","error");return}if(typeof window.sendToVTT!="function"){l("VTT not available. Please open the VTT module first.","error");return}const n=sn(r,t);window.sendToVTT(n,"System",{isHTML:!0}),l(`📡 Spell card for "${r.name}" sent to VTT.`,"success")};document.addEventListener("click",function(e){const t=e.target.closest(".spell-cast-from-vtt");if(!t)return;e.preventDefault();const r=t.dataset.spellId,n=t.dataset.attr;if(!r){l("Spell ID missing.","error");return}const o=v();if(!o){l("No character selected.","error");return}if((o.magicPath||"none")!=="free-caster"){l("Only Free Casters can cast spells.","error");return}window.spellbookUse(r,n)});document.addEventListener("spell-cast-request",function(e){const{spellId:t,attribute:r}=e.detail||{};if(!t||!r)return;const n=v();if(n){if((n.magicPath||"none")!=="free-caster"){l("Only Free Casters can cast spells.","error");return}window.spellbookUse(t,r)}});window.spellbookUse=async function(e,t){const r=v();if(!r)return;if((r.magicPath||"none")!=="free-caster"){ke(`
            <div style="display:flex;flex-direction:column;gap:0.3rem;">
                <div style="font-weight:600;font-size:1rem;color:var(--orange);">🔮 Free Caster Required</div>
                <p style="font-size:0.85rem;color:var(--text2);">
                    Only <strong>Free Casters</strong> can cast spells from their grimoire.
                </p>
                <p style="font-size:0.75rem;color:var(--text3);font-style:italic;">
                    "The Weave answers those who speak its raw grammar." – Lysandra
                </p>
                <div style="display:flex;gap:0.3rem;flex-wrap:wrap;">
                    <button class="btn btn-sm btn-primary" onclick="this.closest('.custom-toast-modal').remove(); window.location.hash='spellcraft';">📖 Go to Spellcraft</button>
                    <button class="btn btn-sm btn-secondary" onclick="this.closest('.custom-toast-modal').remove();">Close</button>
                </div>
            </div>
        `,"warning");return}const n=r.spellbook.find(S=>S.id===e);if(!n){l("Spell not found.","error");return}if(!t&&(t=await window.spellbookPromptAttribute(),t===null))return;const o=r.wits||1,i=r.spirit||1,a=r.skills?.arcana||0,s=t==="spirit"?i:o,c=t==="spirit"?"Spirit":"Wits";let d=s+a;const m=Zr(n);m>0&&(d+=m);const u=n.dv||1;if(d<1){l("Dice pool must be at least 1 die. Increase your Wits/Spirit or Arcana.","error");return}const f=ae(d,u);let h,y,b,$;f.successes>=u&&f.storyBeats===0?(h="clean",y="✨ Clean Success",b="None",$=0):f.successes>=u&&f.storyBeats>0?(h="success_sb",y="⚠️ Success with Consequences",b="Minor",$=0):f.successes>0&&f.successes<u?(h="partial",y="⚠️ Partial Success",b="Moderate",$=1):(h="miss",y="💀 Miss",b="Major",$=2),n.usage=(n.usage||0)+1,f.successes>=u&&(n._successes=(n._successes||0)+1),n.updatedAt=Date.now(),$>0&&(r.boons=(r.boons||0)+$,r.boons>5&&(r.boons=5),l(`+${$} Boon${$>1?"s":""} gained.`,"info")),k({spellbook:r.spellbook,boons:r.boons});let g="",w="var(--text3)";b==="Minor"?(g="Fatigue +1 or -1 die on next roll (GM choice).",w="var(--orange)"):b==="Moderate"?(g="Harm 1 (stress) or a minor Condition.",w="var(--orange)"):b==="Major"?(g="Harm 2, permanent Scar, or reality fracture (GM choice).",w="var(--red)"):(g="No backlash. The Weave bends cleanly.",w="var(--green)");const T=m>0?`⭐ +${m} die (signature)`:"";Wt()&&Nr({caster:r.name||"Unknown Caster",spellName:n.name,attribute:c,pool:d,dv:u,dice:f.dice,successes:f.successes,outcome:y,storyBeats:f.storyBeats||0}),ke(`
        <div style="display:flex;flex-direction:column;gap:0.3rem;">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.2rem;">
                <span style="font-weight:600;font-size:1.05rem;color:${h==="clean"?"var(--gold)":h==="miss"?"var(--red)":"var(--orange)"};">${y}</span>
                <span style="font-size:0.8rem;color:var(--text3);">DV ${u}</span>
            </div>
            <div style="font-size:0.9rem;font-weight:500;">"${p(n.name)}"</div>
            ${T?`<div style="font-size:0.7rem;color:var(--gold);">${T}</div>`:""}
            <div style="font-size:0.75rem;color:var(--text2);">Pool: ${d}d (${c} ${s} + Arcana ${a})</div>
            <div style="font-size:0.75rem;color:var(--text3);">Roll: ${f.dice.join(", ")} → <strong>${f.successes}</strong> successes</div>
            ${f.storyBeats>0?`<div style="font-size:0.75rem;color:var(--text3);">📖 ${f.storyBeats} Story Beats generated</div>`:""}
            ${f.criticalEffect?`<div style="font-size:0.75rem;color:var(--gold);">✨ ${f.criticalEffect}</div>`:""}
            <div style="border-top:1px solid var(--border);padding-top:0.2rem;font-size:0.8rem;color:${w};">
                <strong>⚡ Backlash:</strong> ${b} — ${g}
            </div>
            ${$>0?`<div style="font-size:0.75rem;color:var(--gold);">+${$} Boon${$>1?"s":""} gained</div>`:""}
            ${Wt()?'<div style="font-size:0.6rem;color:var(--text3);">📡 Broadcast to VTT</div>':""}
            <div style="font-size:0.65rem;color:var(--text3);font-style:italic;margin-top:0.1rem;">
                ${h==="clean"?'"The Weave remembers your precision." – Lysandra':h==="miss"?`"The Weave's receipt is your teacher." – Lysandra`:'"Balance the risk and the reward." – Lysandra'}
            </div>
            <div style="font-size:0.6rem;color:var(--text3);">
                Cast ${n.usage} time${n.usage>1?"s":""} · ${n._successes||0} successes
            </div>
        </div>
    `,h==="clean"?"success":h==="miss"?"error":"info"),m>0&&h==="clean"&&setTimeout(()=>{l("⭐ Signature spell resonates! Extra die well spent.","success")},500),setTimeout(()=>{const S=G();S&&D(S)},100)};window.spellbookPromptAttribute=function(){return new Promise(e=>{ke(`
            <div style="display:flex;flex-direction:column;gap:0.5rem;">
                <p style="font-weight:600;">Choose attribute for casting:</p>
                <select id="attribute-prompt-select" style="padding:0.3rem;border-radius:var(--radius);background:var(--bg2);color:var(--text);border:1px solid var(--border);">
                    ${sr.map(t=>`<option value="${t.value}">${t.label}</option>`).join("")}
                </select>
                <div style="display:flex;gap:0.5rem;">
                    <button class="btn btn-primary" id="attribute-prompt-confirm">Cast</button>
                    <button class="btn btn-secondary" id="attribute-prompt-cancel">Cancel</button>
                </div>
            </div>
        `,"info"),setTimeout(()=>{const t=document.getElementById("attribute-prompt-confirm"),r=document.getElementById("attribute-prompt-cancel"),n=document.getElementById("attribute-prompt-select");t&&t.addEventListener("click",()=>{const o=n.value,i=document.querySelector(".custom-toast-modal");i&&i.remove(),e(o)}),r&&r.addEventListener("click",()=>{const o=document.querySelector(".custom-toast-modal");o&&o.remove(),e(null)})},100)})};window.grimoireAddSpiritRelationship=function(){const e=v();if(!e)return;if(!(e.learnedTalents||[]).includes("true-name-keeper")){l("Requires the True Name Keeper talent (15 XP).","error");return}const t=prompt('Spirit name/archetype (e.g., "Ashen Hollow-Wight"):');if(!t||!t.trim())return;const r=prompt("True Name (the word that binds it):")||"",n=prompt("Nature (its temperament, domain, what it wants):")||"";e.spiritRelationships||(e.spiritRelationships=[]),e.spiritRelationships.push({id:Y("spirit_"),name:t.trim(),trueName:r.trim(),nature:n.trim(),disposition:"Neutral",notes:"",timesBound:0,lastBound:null,createdAt:Date.now()}),k({spiritRelationships:e.spiritRelationships}),l(`📖 "${t.trim()}" recorded in your Spirit Relationships.`,"success"),D(G())};window.grimoireEditSpiritRelationship=function(e){const t=v();if(!t)return;const r=(t.spiritRelationships||[]).find(s=>s.id===e);if(!r){l("Spirit not found.","error");return}const n=prompt("Spirit name/archetype:",r.name);if(n===null)return;const o=prompt("True Name:",r.trueName||""),i=prompt("Nature:",r.nature||""),a=prompt("Notes (history, debts, warnings):",r.notes||"");r.name=(n||r.name).trim(),r.trueName=(o||"").trim(),r.nature=(i||"").trim(),r.notes=(a||"").trim(),k({spiritRelationships:t.spiritRelationships}),l(`Updated "${r.name}".`,"success"),D(G())};window.grimoireSetSpiritDisposition=function(e,t){const r=v();if(!r)return;const n=(r.spiritRelationships||[]).find(o=>o.id===e);n&&(n.disposition=t,k({spiritRelationships:r.spiritRelationships}),l(`"${n.name}" is now ${t}.`,"info"))};window.grimoireRecallSpirit=function(e){const t=v();if(!t)return;if(!(t.learnedTalents||[]).includes("true-name-keeper")){l("Requires the True Name Keeper talent.","error");return}const r=(t.spiritRelationships||[]).find(n=>n.id===e);if(!r){l("Spirit not found.","error");return}confirm(`Call "${r.name}" by its true name?

Per True Name Keeper: Leash Capacity is reduced by 2 for this binding.`)&&(r.timesBound=(r.timesBound||0)+1,r.lastBound=Date.now(),k({spiritRelationships:t.spiritRelationships}),l(`👁️ "${r.name}" answers your call. (Leash Capacity −2 for this binding.) Set up the actual binding in the Summoning panel.`,"success"),D(G()))};window.grimoireDeleteSpiritRelationship=function(e){const t=v();if(!t)return;const r=(t.spiritRelationships||[]).find(n=>n.id===e);r&&confirm(`Remove "${r.name}" from your Spirit Relationships? This can't be undone.`)&&(t.spiritRelationships=(t.spiritRelationships||[]).filter(n=>n.id!==e),k({spiritRelationships:t.spiritRelationships}),l("Removed.","info"),D(G()))};window.spellbookExport=function(){const e=v();if(!e)return;const t=e.spellbook||[];if(t.length===0){l("No spells to export.","info");return}const r=JSON.stringify(t,null,2),n=new Blob([r],{type:"application/json"}),o=URL.createObjectURL(n),i=document.createElement("a");i.href=o,i.download=`spellbook-${e.name||"caster"}-${Date.now()}.json`,i.click(),URL.revokeObjectURL(o),l(`📤 Exported ${t.length} spells.`,"success")};window.spellbookImport=function(){const e=document.createElement("input");e.type="file",e.accept=".json",e.onchange=t=>{const r=t.target.files[0];if(!r)return;const n=new FileReader;n.onload=o=>{try{const i=JSON.parse(o.target.result);if(!Array.isArray(i)){l("Invalid spellbook data.","error");return}const a=v();if(!a)return;a.spellbook||(a.spellbook=[]);let s=0;i.forEach(c=>{c.name&&(c.id=Y("spell_"),c.source="imported",c.createdAt=Date.now(),c.updatedAt=Date.now(),a.spellbook.push(c),s++)}),k({spellbook:a.spellbook}),l(`📥 Imported ${s} spells.`,"success"),D(G())}catch{l("Failed to parse spellbook JSON.","error")}},n.readAsText(r)},e.click()};function ke(e,t="info"){const r=document.querySelector(".custom-toast-modal");r&&r.remove();const n=document.createElement("div");n.className="custom-toast-modal",n.style.cssText=`
        position: fixed; bottom: 1rem; right: 1rem; z-index: 9999;
        animation: toastFadeIn 0.2s ease;
    `;const o=document.createElement("div");if(o.style.cssText=`
        background: var(--bg1); padding: 1.5rem; border-radius: var(--radius);
        max-width: 420px; width: 90vw; border: 1px solid var(--border);
        box-shadow: 0 8px 32px rgba(0,0,0,0.5);
        max-height: 60vh; overflow-y: auto;
    `,o.innerHTML=e+`<br><button class="btn btn-sm btn-secondary" onclick="this.closest('.custom-toast-modal').remove()">Close</button>`,n.appendChild(o),document.body.appendChild(n),!document.getElementById("toast-animation-style")){const i=document.createElement("style");i.id="toast-animation-style",i.textContent=`
            @keyframes toastFadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        `,document.head.appendChild(i)}setTimeout(()=>{n.parentNode&&n.remove()},12e3)}var M=null,ie=[],A=[],ht=null,Ge=null;async function pn(){if(M)return M;const e=mn();try{const t=await fetch("./data/wiki.json");if(t.ok){const r=await t.json();if(r.data&&Array.isArray(r.data)){for(const n of r.data)if(n.tags&&n.tags.includes("magic")&&n.mod!==void 0){const o=n.title?.toUpperCase();o&&e.set(o,{name:o,mod:n.mod,category:n.category||"magic",description:n.body||"",example:n.example||""})}}}}catch{console.warn("Could not load wiki.json, using hardcoded tags.")}return M=e,M}function mn(){const e=new Map;for(const[t,r]of Object.entries({Burning:{mod:1,category:"Elemental",description:"Ignite, heat, combustion, smoke",example:"Ember Flick"},Freezing:{mod:1,category:"Elemental",description:"Ice, slowing, brittle shatter, cold",example:"Frost Grasp"},Storm:{mod:1,category:"Elemental",description:"Lightning, shock, arc, thunder",example:"Cracking Lightning"},Stone:{mod:1,category:"Elemental",description:"Walls, spikes, tremors, armor",example:"Grasping Roots"},Wave:{mod:1,category:"Elemental",description:"Crushing water, currents, pressure",example:"Tidal Push"},Wind:{mod:1,category:"Elemental",description:"Levitation, gusts, deflection, push/pull",example:"Reed Walk"},Force:{mod:1,category:"Force",description:"Kinetic power, shields, blasts, telekinesis",example:"Unseen Hand"},Area:{mod:1,category:"Force",description:"Cone, circle, corridor, zone effect",example:"Eruption"},Strike:{mod:1,category:"Force",description:"Single target precision",example:"Fate's Needle"},Wall:{mod:1,category:"Force",description:"Barrier or blockade",example:"Stone Wall"},Bind:{mod:1,category:"Force",description:"Restrain, hold, suspend, entangle",example:"Grasping Roots"},Dispel:{mod:1,category:"Force",description:"Suppress magic, unravel ongoing effects",example:"Cleansing Light"},Veil:{mod:1,category:"Mind/Illusion",description:"Conceal, blur, illusion, silence",example:"Shadow Cloak"},Scry:{mod:1,category:"Mind/Illusion",description:"Reveal hidden, see distance, read traces",example:"Echoing Trace"},Memory:{mod:1,category:"Mind/Illusion",description:"Erase, alter, restore memories",example:"Forgotten Name"},Command:{mod:1,category:"Mind/Illusion",description:"Compel a short action (one word)",example:"Blazing Decree"},Fear:{mod:1,category:"Mind/Illusion",description:"Panic, flee, break morale",example:"Crushing Dark"},HEAL:{mod:1,category:"Life/Body",description:"Close wounds, restore flesh, reduce Harm 1",example:"Lay on Hands"},Purify:{mod:1,category:"Life/Body",description:"Remove poison, corruption, disease",example:"Cleansing Light"},Strengthen:{mod:1,category:"Life/Body",description:"Enhance body, armor, senses (temporary)",example:"Boon of Vigor"},Waken:{mod:1,category:"Life/Body",description:"Counter sleep, paralysis, stun",example:"Rousing Call"},Beast:{mod:1,category:"Life/Body",description:"Speak with or influence animals",example:"Verdant Tongue"},Leap:{mod:2,category:"Space/Motion",description:"Jump far, blink across short space (Near)",example:"Reed Walk"},Fold:{mod:2,category:"Space/Motion",description:"Short-range teleport, vanish-reappear (Far)",example:"Shadow Step"},Gate:{mod:2,category:"Space/Motion",description:"Long distance passage, open/close path",example:"Waymark"},Gravity:{mod:2,category:"Space/Motion",description:"Crush, lift, suspend, walk on walls/ceiling",example:"Crushing Dark"},Create:{mod:2,category:"Creation",description:"Manifest mundane matter briefly (1 scene)",example:"Momentary Forge"},Summon:{mod:2,category:"Creation",description:"Call a being or construct",example:"Unquiet Host"},Transmute:{mod:2,category:"Creation",description:"Turn one thing into another (temporary)",example:"Shed Skin"},Animate:{mod:2,category:"Creation",description:"Make objects act with intent (1 scene)",example:"Living Weapon"},Sense:{mod:1,category:"Utility",description:"Detect presence of a named tag/element",example:"Lingering Trace"},Reveal:{mod:1,category:"Utility",description:"Unveil hidden, glamoured, or invisible things",example:"Echoing Truth"},Light:{mod:1,category:"Utility",description:"Create illumination (glow, torch-bright)",example:"Dawnlight"},Shadow:{mod:1,category:"Utility",description:"Deepen darkness, hide edges, obscure",example:"Umbral Veil"},Silence:{mod:1,category:"Utility",description:"Suppress sound in zone or on target",example:"Hush"},Protect:{mod:1,category:"Utility",description:"Reduce/deflect next harm (Armor 1)",example:"Aegis"},Counter:{mod:1,category:"Reaction",description:"Interrupt a casting/ritual in its window",example:"Mage's Rebuke"},Reflect:{mod:2,category:"Reaction",description:"Turn next targeted effect back on its source",example:"Mirror's Edge"},Store:{mod:2,category:"Utility",description:"Bank 1-2 successes in a vessel (once)",example:"Reservoir"},Curse:{mod:2,category:"Affliction",description:"Attach hostile tag/timer to target",example:"Thorn's Bargain"},Bless:{mod:1,category:"Affliction",description:"Grant favourable tag (luck, favor, ward-key)",example:"Tide's Favor"}}))e.set(t,{...r,name:t});return e}var Pt={Elemental:"#e67e22",Force:"#e74c3c","Mind/Illusion":"#8e44ad","Life/Body":"#27ae60","Space/Motion":"#2980b9",Creation:"#f39c12",Utility:"#7f8c8d",Reaction:"#c0392b",Affliction:"#d35400"},un={Elemental:"🔥",Force:"💥","Mind/Illusion":"🧠","Life/Body":"💚","Space/Motion":"🌀",Creation:"✨",Utility:"🔧",Reaction:"⚡",Affliction:"💀"},fn=["Elemental","Force","Mind/Illusion","Life/Body","Space/Motion","Creation","Utility","Reaction","Affliction"],gn=[{icon:"🔥",label:"Free Caster",blurb:"Raw TAGS grammar, no patron — pure will and improvisation."},{icon:"📖",label:"Runekeeper",blurb:"Bound to one patron via Thiasos or Codex; steady Rites."},{icon:"🔯",label:"Invoker",blurb:"Carries Symbols from multiple patrons; risks Cross-Resonance."},{icon:"🎵",label:"Cantor",blurb:"Sings a patron's Rites as Songs; Corruption blooms with Pushing."},{icon:"👁️",label:"Summoner",blurb:"Binds spirits from the Bestiary; manages the Leash."},{icon:"🌿",label:"Witch",blurb:"Hedge magic at Thresholds, paid in Shadow, Shame, Identity Strain."},{icon:"🧠",label:"Psion",blurb:"Mind-born power fueled by Mental Strain."},{icon:"🧘",label:"Monk",blurb:"Patron-optional path of Breath States and monastic Techniques."},{icon:"🦅",label:"Familiar Only",blurb:"A bonded companion without a full magic path."},{icon:"🍃",label:"Hedge Gifts",blurb:"Small universal gifts available to any character."}];function hn(e){return`
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:0.4rem;text-align:left;margin-top:0.8rem;">
            ${gn.map(t=>`
                <div style="padding:0.4rem 0.5rem;border-radius:var(--radius);background:var(--bg2);border:1px solid ${t.label===e?"var(--gold)":"var(--border)"};">
                    <div style="display:flex;align-items:center;gap:0.3rem;">
                        <span style="font-size:1.1rem;">${t.icon}</span>
                        <strong style="font-size:0.82rem;${t.label===e?"color:var(--gold);":""}">${t.label}</strong>
                    </div>
                    <div style="font-size:0.68rem;color:var(--text3);margin-top:0.15rem;line-height:1.3;">${t.blurb}</div>
                </div>
            `).join("")}
        </div>
    `}var bn=[{name:"🔥 Firebolt",tags:["Burning","Strike"],description:"A bolt of flame strikes a single target."},{name:"❄️ Frost Grasp",tags:["Freezing","Bind"],description:"Ice encases a target, holding them in place."},{name:"🌿 Healing Touch",tags:["HEAL","Strengthen"],description:"Close wounds and restore vitality to a touched ally."},{name:"🌀 Telekinetic Push",tags:["Force","Wind","Strike"],description:"A blast of force knocks a target back."},{name:"🌙 Shadow Veil",tags:["Veil","Shadow","Silence"],description:"Conceal yourself and allies in moving shadow."},{name:"⚡ Storm Bolt",tags:["Storm","Strike","Area"],description:"A crackling bolt of lightning arcs through a zone."},{name:"🛡️ Aegis",tags:["Protect","Strengthen","Force"],description:"A shimmering barrier protects you from harm."},{name:"🔮 Scrying Eye",tags:["Scry","Sense","Reveal"],description:"Glimpse a distant place or hidden truth."},{name:"💀 Leashed Curse",tags:["Curse","Bind","Fear"],description:"A curse that tightens as the target struggles."},{name:"✨ Momentary Forge",tags:["Create","Transmute","Animate"],description:"Shape raw matter into a temporary tool or weapon."}],pr={Burning:"Pair with Wind for a spreading fire, or with Strike for a concentrated bolt.",Freezing:"Pair with Bind to trap, or with Area for a chilling fog.",Storm:"Pair with Strike for a lightning bolt, or with Area for a thunderclap.",Stone:"Pair with Wall for a barrier, or with Bind for a cage.",Wave:"Pair with Area for a tidal surge, or with Strike for a water jet.",Wind:"Pair with Leap for a jump, or with Force for a gust.",Force:"The foundation of telekinesis. Pairs with almost anything.",Area:"Makes a spell affect a zone. Costs more DV but affects multiple targets.",Strike:"Focused single-target damage. Pairs with elemental tags.",Wall:"Creates a barrier. Pairs with Stone, Force, or even Shadow.",Bind:"Restrains a target. Pairs with Freezing, Stone, or Fear.",Dispel:"Counters magic. Pair with Counter for a reactive dispel.",Veil:"Concealment and illusion. Pairs with Shadow or Silence.",Scry:"Distant perception. Pairs with Sense or Reveal.",Memory:"Mind magic. Handle with care—Backlash is steep.",Command:"One-word compulsion. High risk, high reward.",Fear:"Area morale break. Pairs with Command or Bind.",HEAL:"Restoration magic. Safe and reliable.",Purify:"Cleansing. Essential for dealing with corruption.",Strengthen:"Temporary buffs. Pairs with Protect or HEAL.",Waken:"Counter to sleep/stun. Situational but clutch.",Beast:"Animal communication. Pairs with Sense.",Leap:"Short-range teleport. Pairs with Wind or Shadow.",Fold:"Long-range teleport. Very high DV. Use sparingly.",Gate:"Create a passage. Requires serious DV.",Gravity:"Alter gravity. High risk of Backlash.",Create:"Manifest matter. Brief but versatile.",Summon:"Call a being. Requires other tags to specify.",Transmute:"Change form. High Backlash risk.",Animate:"Give objects life. Brief and limited.",Sense:"Detection magic. Cheap and reliable.",Reveal:"Pierce illusions. Pairs with Sense.",Light:"Illumination. Simple and safe.",Shadow:"Darkness. Pairs with Veil or Silence.",Silence:"Sound suppression. Pairs with Veil.",Protect:"Defensive. Pairs with Strengthen.",Counter:"Reactive. Triggers when someone casts near you.",Reflect:"Redirect magic. Very high risk.",Store:"Bank successes. Prep time required.",Curse:"Hostile affliction. High risk of spreading.",Bless:"Friendly affliction. Reliable and appreciated."};function vn(e){const t=e.toUpperCase();if(!M||!M.has(t)){l(`Unknown tag: "${e}" — check the lexicon.`,"warning");return}if(A.includes(t)){l(`"${e}" already added.`,"info");return}A.push(t),Oe(),mr(t)}function yn(e){A=A.filter(t=>t!==e),Oe(),Rt()}function wn(){A=[],Oe();const e=document.getElementById("tags-input");e&&(e.value=""),Rt()}function xn(){A=[],ht&&ur(ht),l("🔄 Calculator refreshed.","info")}function mr(e){const t=document.getElementById("tag-hint");if(!t)return;const r=e.toUpperCase(),n=M?M.get(r):null,o=pr[r]||n?.description||"";o?(t.innerHTML=`💡 <strong>${p(r)}</strong>: ${p(o)}`,t.style.color="var(--text2)"):(t.innerHTML=`💡 ${p(r)} — no specific hints, but experiment!`,t.style.color="var(--text3)")}function Rt(){const e=document.getElementById("tag-hint");if(e)if(A.length>0){const t=A[A.length-1],r=M?M.get(t):null;e.innerHTML=`💡 <strong>${p(t)}</strong>: ${r?.description||"Experiment with combinations!"}`,e.style.color="var(--text3)"}else e.innerHTML="💡 Select a tag to see how it works with others.",e.style.color="var(--text3)"}function $n(){if(A.length===0){l("Add some tags first.","error");return}const e=v();if(!e)return;const t=A.join(" "),r=t.length>40?t.substring(0,37)+"...":t,n=prompt("Spell name:",r);if(!n)return;const o=prompt("Effect description:",fr(A))||"",i=ot(A),a=i.dv,s={id:Y("spell_"),name:n.trim(),description:o.trim(),tags:A.slice(),dv:a,breakdown:i.breakdown,totalMod:i.totalMod,source:"calculator",createdAt:Date.now(),updatedAt:Date.now(),_successes:0,_failures:0,_lastUsed:null};e.spellbook||(e.spellbook=[]);const c=e.spellbook.findIndex(d=>d.name===s.name&&d.tags?.join(",")===s.tags.join(","));if(c>=0){if(!confirm(`"${s.name}" already exists in your spellbook. Overwrite?`))return;e.spellbook[c]=s}else e.spellbook.push(s);k({spellbook:e.spellbook}),ie=e.spellbook.filter(d=>d.source==="calculator"||d.source==="custom"),l(`✨ "${s.name}" saved to spellbook (DV ${a}).`,"success"),A=[],Oe()}function kn(){if(A.length===0){l("Add some tags first.","error");return}const e=v();if(!e)return;const{dv:t}=ot(A),r=e.wits||1,n=e.skills?.arcana||0,o=r+n;if(o<1){l("Dice pool must be at least 1 die. Increase your Wits or Arcana.","error");return}const i=ae(o,t);let a,s,c,d;i.successes>=t&&i.storyBeats===0?(a="✨ Clean Success",s="None",c="The Weave bends perfectly. No cost.",d="var(--gold)"):i.successes>=t&&i.storyBeats>0?(a="⚠️ Success with Consequences",s="Minor",c="Fatigue +1 or -1 die on next roll (GM choice).",d="var(--orange)"):i.successes>0&&i.successes<t?(a="⚠️ Partial Success",s="Moderate",c="Harm 1 (stress) or a minor Condition.",d="var(--orange)"):(a="💀 Miss",s="Major",c="Harm 2, permanent Scar, or reality fracture (GM choice).",d="var(--red)");const m=A.join(" ");e._spellcraftHistory===void 0&&(e._spellcraftHistory=[]);const u=m+"-"+A.join("|");let f=e._spellcraftHistory.find(h=>h.spellId===u);f||(f={spellId:u,spellName:m,tags:A.slice(),successes:0,failures:0,lastUsed:null},e._spellcraftHistory.push(f)),i.successes>=t?f.successes++:f.failures++,f.lastUsed=Date.now(),k({_spellcraftHistory:e._spellcraftHistory}),At(`
        <div style="display:flex;flex-direction:column;gap:0.3rem;">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.2rem;">
                <span style="font-weight:600;font-size:1.05rem;color:${d};">${a}</span>
                <span style="font-size:0.8rem;color:var(--text3);">DV ${t}</span>
            </div>
            <div style="font-size:0.9rem;font-weight:500;">${p(m)}</div>
            <div style="font-size:0.75rem;color:var(--text2);">Pool: ${o}d (Wits ${r} + Arcana ${n})</div>
            <div style="font-size:0.75rem;color:var(--text3);">Roll: ${i.dice.join(", ")} → <strong>${i.successes}</strong> successes</div>
            ${i.storyBeats>0?`<div style="font-size:0.75rem;color:var(--text3);">📖 ${i.storyBeats} Story Beats generated</div>`:""}
            ${i.criticalEffect?`<div style="font-size:0.75rem;color:var(--gold);">✨ ${i.criticalEffect}</div>`:""}
            <div style="border-top:1px solid var(--border);padding-top:0.2rem;font-size:0.8rem;color:${s==="None"?"var(--green)":"var(--red)"};">
                <strong>⚡ Backlash:</strong> ${s} — ${c}
            </div>
            <div style="font-size:0.65rem;color:var(--text3);font-style:italic;margin-top:0.1rem;">
                ${i.successes>=t?'"The Weave remembers your precision." – Lysandra':`"The Weave's receipt is your teacher." – Lysandra`}
            </div>
            <div style="font-size:0.6rem;color:var(--text3);margin-top:0.1rem;">
                Tracked: ${f.successes} successes · ${f.failures} failures
            </div>
        </div>
    `,i.successes>=t?"success":"warning")}function Sn(){if(A.length===0){l("Add some tags first.","error");return}const e=v();if(!e)return;const{dv:t}=ot(A),r=e.wits||1,n=e.skills?.arcana||0,o=r+n;if(o<1){l("Dice pool must be at least 1 die. Increase your Wits or Arcana.","error");return}const i=[];for(let c=0;c<3;c++){const d=ae(o,t);let m="";d.successes>=t&&d.storyBeats===0?m="✨ Clean":d.successes>=t&&d.storyBeats>0?m="⚠️ Success":d.successes>0&&d.successes<t?m="⚠️ Partial":m="💀 Miss",i.push(m)}const a=i.filter(c=>c==="✨ Clean").length>1?"Clean Success":i.filter(c=>c==="💀 Miss").length>1?"Miss":"Mixed Results",s=A.join(" ");At(`
        <div style="display:flex;flex-direction:column;gap:0.3rem;">
            <div style="font-weight:600;font-size:1rem;color:var(--gold);">🎰 The Weave's Odds</div>
            <div style="font-size:0.85rem;">${p(s)} (DV ${t})</div>
            <div style="font-size:0.75rem;color:var(--text3);">Pool: ${o}d (Wits ${r} + Arcana ${n})</div>
            <div style="display:flex;gap:0.5rem;font-size:0.8rem;margin:0.2rem 0;">
                <span>🎲 ${i[0]}</span>
                <span>🎲 ${i[1]}</span>
                <span>🎲 ${i[2]}</span>
            </div>
            <div style="border-top:1px solid var(--border);padding-top:0.2rem;font-size:0.8rem;color:var(--text2);">
                <strong>Most likely outcome:</strong> ${a}
            </div>
            <div style="font-size:0.65rem;color:var(--text3);font-style:italic;">
                ${t<=3?'"The Weave welcomes the bold."':t<=5?'"Balance the risk and the reward."':'"The Weave hungers for the reckless."'}
            </div>
            <button class="btn btn-xs btn-secondary" onclick="this.closest('div').parentElement.remove()">Close</button>
        </div>
    `,"info")}function Tn(){const e=v();if(!e)return;if(e.spellbook&&(ie=e.spellbook.filter(a=>a.source==="calculator"||a.source==="custom")),ie.length===0){l("No spells created with the calculator yet.","info");return}const t=ie.slice(-8).reverse().map(a=>(a._successes!==void 0&&a._successes+a._failures>0&&Math.round(a._successes/(a._successes+a._failures)*100),`• <strong>${p(a.name)}</strong> (DV ${a.dv}) – ${a.tags.join(" ")}${a._successes!==void 0?` <span style="color:var(--text3);font-size:0.7rem;">✨${a._successes} 💀${a._failures||0}</span>`:""}`)).join("<br>"),r=ie.length,n=ie.reduce((a,s)=>a+(s._successes||0),0),o=ie.reduce((a,s)=>a+(s._failures||0),0),i=n+o;At(`
        <div style="display:flex;flex-direction:column;gap:0.3rem;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
                <span style="font-weight:600;font-size:1rem;color:var(--gold);">📜 Spell History</span>
                <span style="font-size:0.7rem;color:var(--text3);">${r} spells</span>
            </div>
            <div style="font-size:0.75rem;color:var(--text3);">
                ✨ ${n} successes · 💀 ${o} failures · 🎯 ${i>0?Math.round(n/i*100):"—"}% success rate
            </div>
            <div style="font-size:0.85rem;color:var(--text2);max-height:250px;overflow-y:auto;border-top:1px solid var(--border);padding-top:0.2rem;">
                ${t}
            </div>
            <div style="font-size:0.65rem;color:var(--text3);font-style:italic;margin-top:0.1rem;">
                "Every cast is a lesson." – Lysandra
            </div>
            <button class="btn btn-xs btn-secondary" onclick="this.closest('div').parentElement.remove()">Close</button>
        </div>
    `,"info")}window.calculatorAddTag=vn;window.calculatorRemoveTag=yn;window.calculatorClear=wn;window.calculatorRefresh=xn;window.calculatorShowHint=mr;window.calculatorClearHint=Rt;window.calculatorSaveSpell=$n;window.calculatorTestCast=kn;window.calculatorGamble=Sn;window.calculatorShowHistory=Tn;async function ur(e){ht=e;const t=v();if(!t||t.magicPath!=="free-caster"){e.innerHTML=`
            <div style="text-align:center;padding:1rem;color:var(--text3);">
                <div style="font-size:2rem;">🔮</div>
                <p><strong>Free Caster Calculator</strong></p>
                <p style="font-size:0.85rem;">Select a character with the <strong>Free Caster</strong> magic path to access the TAGS calculator.</p>
                <p style="font-size:0.75rem;color:var(--text3);">Free Casters weave the raw Weave using TAGS – no patron, no codex, only will and grammar.</p>
                ${t?"":`
                    <div style="margin-top:0.5rem;font-weight:600;color:var(--gold);">📚 Magic Paths Reference</div>
                    ${hn("Free Caster")}
                `}
            </div>
        `;return}await pn(),t.spellbook&&(ie=t.spellbook.filter(r=>r.source==="custom"||r.source==="calculator"||r.source==="tags-calculator"),t._spellcraftHistory&&(ie=ie.map(r=>{const n=t._spellcraftHistory?.find(o=>o.spellId===r.id);return n&&(r._successes=n.successes||0,r._failures=n.failures||0,r._lastUsed=n.lastUsed||null),r}))),e.innerHTML=`
        <div class="calculator-container" style="display:flex;flex-direction:column;gap:0.5rem;">
            <!-- ─── Header ─────────────────────────────────────── -->
            <div class="calculator-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.3rem;border-bottom:2px solid var(--border);padding-bottom:0.3rem;">
                <div style="display:flex;align-items:center;gap:0.4rem;">
                    <span style="font-size:1.4rem;">🔮</span>
                    <div>
                        <span style="font-weight:600;font-size:1.1rem;color:var(--gold);">The Weave's Grammar</span>
                        <span style="font-size:0.7rem;color:var(--text3);margin-left:0.5rem;">TAGS Calculator</span>
                    </div>
                </div>
                <div style="display:flex;gap:0.3rem;flex-wrap:wrap;">
                    <button class="btn btn-xs btn-secondary" onclick="window.calculatorClear()">✕ Clear</button>
                    <button class="btn btn-xs btn-secondary" onclick="window.calculatorRefresh()">🔄 Refresh</button>
                </div>
            </div>

            <!-- ─── Quick Templates ───────────────────────────── -->
            <div style="display:flex;gap:0.2rem;flex-wrap:wrap;padding:0.1rem 0;border-bottom:1px solid var(--border);">
                <span style="font-size:0.65rem;color:var(--text3);padding-right:0.3rem;">⚡ Quick:</span>
                ${bn.map(r=>`
                    <button class="btn btn-xs btn-ghost template-btn" style="font-size:0.6rem;padding:0.05rem 0.4rem;" data-tags="${r.tags.join(",")}">${p(r.name)}</button>
                `).join("")}
            </div>

            <!-- ─── Main Workspace ────────────────────────────── -->
            <div class="calculator-workspace" style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;">
                <!-- Left: Input -->
                <div style="display:flex;flex-direction:column;gap:0.3rem;">
                    <div style="font-size:0.75rem;color:var(--text3);">"Name your tags. The Weave listens."</div>
                    <div style="display:flex;gap:0.3rem;flex-wrap:wrap;">
                        <div style="flex:1;min-width:120px;position:relative;">
                            <input type="text" id="tags-input" placeholder="Type a tag..." style="width:100%;font-size:0.85rem;background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:0.25rem 0.5rem;color:var(--text);" />
                            <div id="tag-suggestions" style="position:absolute;top:100%;left:0;right:0;background:var(--bg1);border:1px solid var(--border);border-radius:var(--radius);max-height:150px;overflow-y:auto;display:none;z-index:20;box-shadow:0 4px 12px rgba(0,0,0,0.3);"></div>
                        </div>
                        <button class="btn btn-sm btn-primary" id="add-tag-btn">➕ Add</button>
                    </div>
                    <div id="active-tags" style="display:flex;flex-wrap:wrap;gap:0.2rem;min-height:2.2rem;padding:0.2rem;background:var(--bg2);border-radius:var(--radius);border:1px dashed var(--border);">
                        <span style="font-size:0.65rem;color:var(--text3);">Add tags to build your spell.</span>
                    </div>
                    ${Object.entries(pr).length>0?`
                        <div id="tag-hint" style="font-size:0.65rem;color:var(--text3);min-height:1.5rem;font-style:italic;padding:0.1rem 0.2rem;">
                            💡 Select a tag to see how it works with others.
                        </div>
                    `:""}
                </div>

                <!-- Right: Result -->
                <div id="calc-result" style="background:var(--bg2);border-radius:var(--radius);padding:0.5rem;border:1px solid var(--border);min-height:110px;display:flex;flex-direction:column;justify-content:center;">
                    <div style="text-align:center;color:var(--text3);font-size:0.85rem;">
                        <div style="font-size:2rem;">✧</div>
                        <p>Add tags to weave your spell.</p>
                    </div>
                </div>
            </div>

            <!-- ─── Actions ────────────────────────────────────── -->
            <div style="display:flex;gap:0.3rem;flex-wrap:wrap;padding:0.2rem 0;">
                <button class="btn btn-sm btn-gold" id="save-spell-btn">💾 Save as Spell</button>
                <button class="btn btn-sm btn-secondary" id="roll-test-btn">🎲 Test Cast</button>
                <button class="btn btn-sm btn-secondary" id="gamble-btn">🎰 Gamble</button>
                <button class="btn btn-sm btn-secondary" id="clear-tags-btn">🧹 Clear</button>
                <button class="btn btn-sm btn-ghost" onclick="window.calculatorShowHistory()">📜 History</button>
            </div>

            <!-- ─── Tag Library ────────────────────────────────── -->
            <div class="calculator-library" style="background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;border:1px solid var(--border);">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.2rem;">
                    <span style="font-size:0.8rem;font-weight:600;color:var(--gold);">📖 The Weave's Lexicon</span>
                    <span style="font-size:0.6rem;color:var(--text3);">${M?M.size:0} tags</span>
                </div>
                <div id="tag-library" style="display:flex;flex-wrap:wrap;gap:0.2rem;max-height:120px;overflow-y:auto;">
                    ${M?Cn():'<span style="font-size:0.7rem;color:var(--text3);">Loading tags...</span>'}
                </div>
            </div>

            <!-- ─── Quick Reference ────────────────────────────── -->
            <div class="calculator-quickref" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:0.1rem;font-size:0.6rem;color:var(--text3);background:var(--bg2);border-radius:var(--radius);padding:0.15rem 0.3rem;">
                <div>📐 <strong>DV:</strong> 1 + tags + mods</div>
                <div>⚡ <strong>Dangerous:</strong> +2 DV</div>
                <div>💥 <strong>Backlash:</strong> by DV</div>
                <div>📖 <strong>Tags:</strong> Intent + Grammar</div>
                <div>🎯 <strong>Pool:</strong> Wits + Arcana</div>
            </div>
        </div>
    `,zn(e)}function Cn(){if(!M)return"";const e=Array.from(M.keys()).sort(),t={};for(const n of e){const o=M.get(n).category||"Utility";t[o]||(t[o]=[]),t[o].push(n)}let r="";for(const n of fn){const o=t[n]||[];if(o.length===0)continue;const i=Pt[n]||"var(--text3)",a=un[n]||"📌";r+=`
            <div style="display:flex;align-items:center;gap:0.2rem;margin-right:0.3rem;flex-wrap:wrap;">
                <span style="font-size:0.6rem;color:${i};font-weight:600;">${a} ${n}</span>
                <span style="display:flex;gap:0.1rem;flex-wrap:wrap;">
                    ${o.map(s=>`
                        <span class="tag-pill" style="font-size:0.55rem;padding:0.05rem 0.3rem;border-radius:8px;background:var(--bg3);border:1px solid ${i};color:${i};cursor:pointer;" 
                              onclick="window.calculatorAddTag('${s}')" 
                              onmouseenter="window.calculatorShowHint('${s}')"
                              onmouseleave="window.calculatorClearHint()">
                            ${p(s)}
                        </span>
                    `).join("")}
                </span>
            </div>
        `}return r}function zn(e){const t=e.querySelector("#tags-input"),r=e.querySelector("#add-tag-btn"),n=e.querySelector("#clear-tags-btn"),o=e.querySelector("#save-spell-btn"),i=e.querySelector("#roll-test-btn"),a=e.querySelector("#gamble-btn"),s=e.querySelector("#tag-suggestions"),c=()=>{if(!t)return;const d=t.value.trim().toUpperCase();d&&(window.calculatorAddTag(d),t.value="",t.focus(),s&&(s.style.display="none"))};r&&r.addEventListener("click",c),t&&(t.addEventListener("keydown",d=>{d.key==="Enter"&&(d.preventDefault(),c()),d.key==="Escape"&&s&&(s.style.display="none")}),t.addEventListener("input",d=>{const m=d.target.value.trim().toUpperCase();if(!m||!M){s&&(s.style.display="none");return}const u=Array.from(M.keys()).filter(y=>y.startsWith(m)).slice(0,10),f=u.length===0?Array.from(M.keys()).filter(y=>y.includes(m)).slice(0,8):u,h=u.length>0?u.slice(0,8):f;if(h.length===0){s&&(s.style.display="none");return}s&&(s.style.display="block",s.innerHTML=h.map(y=>{const b=M.get(y),$=b&&Pt[b.category]||"var(--text3)";return`
                        <div class="suggestion-item" style="display:flex;justify-content:space-between;padding:0.2rem 0.5rem;cursor:pointer;border-bottom:1px solid var(--border);font-size:0.8rem;color:var(--text);" 
                             onclick="window.calculatorAddTag('${y}'); document.getElementById('tags-input').value=''; document.getElementById('tag-suggestions').style.display='none';">
                            <span style="font-weight:500;">${p(y)}</span>
                            <span style="font-size:0.6rem;color:${$};">${b?b.category||"magic":"?"} ${b?`(+${b.mod})`:""}</span>
                        </div>
                    `}).join(""))}),t.addEventListener("blur",()=>{setTimeout(()=>{s&&(s.style.display="none")},250)})),e.querySelectorAll(".template-btn").forEach(d=>{d.addEventListener("click",()=>{const m=(d.dataset.tags||"").split(",").map(u=>u.trim().toUpperCase()).filter(Boolean);window.calculatorClear();for(const u of m)u&&M&&M.has(u)&&A.push(u);Oe(),l(`Loaded template: ${d.textContent.trim()}`,"info")})}),n&&n.addEventListener("click",window.calculatorClear),o&&o.addEventListener("click",window.calculatorSaveSpell),i&&i.addEventListener("click",window.calculatorTestCast),a&&a.addEventListener("click",window.calculatorGamble),Ge&&document.removeEventListener("click",Ge),Ge=d=>{s&&!s.contains(d.target)&&d.target!==t&&(s.style.display="none")},document.addEventListener("click",Ge)}function fr(e){if(!e||e.length===0)return"";const t=[];for(const n of e){const o=M?M.get(n):null;o&&o.description?t.push(o.description.split(",")[0].trim()):t.push(n)}const r=t.join(" with ");return r.charAt(0).toUpperCase()+r.slice(1)+"."}function ot(e){let t=1+e.length,r=0,n=[],o=[];for(const i of e)if(M&&M.has(i)){const a=M.get(i).mod||1;r+=a;const s=a>1?"⚡":"";n.push(`${i}${s} (+${a})`)}else o.push(i),n.push(`${i} (?)`);return t+=r,{dv:t,totalMod:r,breakdown:n,unknownTags:o}}function Oe(){const e=document.getElementById("calc-result"),t=document.getElementById("active-tags");if(!e||!t)return;if(A.length===0?t.innerHTML='<span style="font-size:0.65rem;color:var(--text3);">Add tags to build your spell.</span>':(t.innerHTML=A.map(u=>{const f=M?M.get(u):null,h=f&&Pt[f.category]||"var(--gold)",y=f?f.mod:1;return`
                <span class="tag-badge" style="display:inline-flex;align-items:center;gap:0.2rem;padding:0.1rem 0.4rem;border-radius:12px;background:${h}22;border:1px solid ${h};font-size:0.7rem;color:${h};cursor:pointer;" 
                      onclick="window.calculatorRemoveTag('${u}')"
                      onmouseenter="window.calculatorShowHint('${u}')"
                      onmouseleave="window.calculatorClearHint()">
                    ${p(u)}
                    <span style="font-size:0.55rem;opacity:0.7;">+${y}</span>
                    <span style="font-size:0.55rem;">✕</span>
                </span>
            `}).join(""),A.length>0&&window.calculatorShowHint(A[A.length-1])),A.length===0){e.innerHTML=`
            <div style="text-align:center;color:var(--text3);font-size:0.85rem;">
                <div style="font-size:2rem;">✧</div>
                <p>Add tags to weave your spell.</p>
            </div>
        `;return}const{dv:r,totalMod:n,breakdown:o,unknownTags:i}=ot(A);let a,s,c;r<=3?(a="Low",s="var(--green)",c="Minor Backlash: Fatigue or -1 die."):r<=5?(a="Moderate",s="var(--orange)",c="Moderate Backlash: Harm 1 or a Condition."):r<=7?(a="High",s="var(--red)",c="Major Backlash: Harm 2 or a Scar."):(a="Catastrophic",s="#8b0000",c="Catastrophic Backlash: Harm 3, permanent damage, or reality fracture.");const d=A.join(" "),m=fr(A);e.innerHTML=`
        <div style="display:flex;flex-direction:column;gap:0.2rem;height:100%;">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.2rem;">
                <span style="font-weight:600;font-size:0.95rem;color:var(--gold);">${p(d)}</span>
                <span style="font-size:0.8rem;font-weight:600;color:${s};padding:0.05rem 0.4rem;border-radius:8px;background:${s}22;border:1px solid ${s};">DV ${r}</span>
            </div>
            <div style="font-size:0.75rem;color:var(--text2);font-style:italic;margin-bottom:0.1rem;">
                "${p(m)}"
            </div>
            <div style="font-size:0.65rem;color:var(--text3);">
                ${o.join(" + ")}
                ${i.length?`<span style="color:var(--red);"> ⚠️ Unknown: ${i.join(", ")}</span>`:""}
            </div>
            <div style="display:flex;gap:0.4rem;flex-wrap:wrap;font-size:0.7rem;border-top:1px solid var(--border);padding-top:0.1rem;margin-top:0.1rem;">
                <span>📊 Tags: ${A.length}</span>
                <span>📐 Modifiers: +${n}</span>
                <span style="color:${s};">💥 Risk: ${a}</span>
                <span style="font-size:0.6rem;color:var(--text3);">${c}</span>
            </div>
            ${a==="Catastrophic"?'<div style="font-size:0.7rem;color:#8b0000;font-weight:600;">⚠️ THIS SPELL COULD UNMAKE YOU. Proceed with caution.</div>':""}
        </div>
    `}function At(e,t="info"){if(typeof window.spellbookShowToastWithHTML=="function"){window.spellbookShowToastWithHTML(e,t);return}const r=document.createElement("div");r.style.cssText=`
        position: fixed; bottom: 1rem; right: 1rem; z-index: 9999;
        animation: toastFadeIn 0.2s ease;
    `;const n=document.createElement("div");if(n.style.cssText=`
        background: var(--bg1); padding: 1.2rem; border-radius: var(--radius);
        max-width: 420px; width: 90vw; border: 1px solid var(--border);
        box-shadow: 0 8px 32px rgba(0,0,0,0.5);
        max-height: 60vh; overflow-y: auto;
    `,n.innerHTML=e+`<br><button class="btn btn-xs btn-secondary" onclick="this.closest('div').parentElement.remove()">Close</button>`,r.appendChild(n),document.body.appendChild(r),!document.getElementById("toast-animation-style")){const o=document.createElement("style");o.id="toast-animation-style",o.textContent=`
            @keyframes toastFadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        `,document.head.appendChild(o)}setTimeout(()=>{r.parentNode&&r.remove()},12e3)}function Pn(e){const t=v();if(!t){e.innerHTML='<p style="color:var(--text3);">Select a character to view tracks.</p>';return}const r=t.magicPath||"none",n=t.body||1,o=t.spirit||1,i=t.presence||1;t.wits;const a=t.fatigue||0,s=n,c=t.harm||0,d=3,m=t.totalXp||0,u=t.obligation||0,f=o+i||1,h=t.corruption||0,y=t.corruptionMax||o,b=t.leash||0,$=t.leashMax||4,g=t.mentalStrain||0,w=t.mentalStrainMax||o,T=t.shadow??0,S=t.shame??0,x=t.identityStrain??0,z=t.promiseTimers?.length||0,H=t.bloomCount||0,B=t.breathState||"entering",V=t.breathScars||[],P=t.monkCorruptionTier||0,I=t.meditationProgress||0,L=t.boundSpirits?.length||0;let R=`
        <div class="trackers-grid" style="display:flex;flex-wrap:wrap;gap:0.4rem 0.8rem;padding:0.2rem 0;">
    `;const N=s>0?Math.min(100,a/s*100):0;R+=`
        <div class="tracker-item" style="flex:1;min-width:80px;max-width:140px;">
            <div style="display:flex;justify-content:space-between;font-size:0.75rem;">
                <span>💪 Fatigue</span>
                <span>${a}/${s}</span>
            </div>
            <div style="width:100%;height:5px;background:var(--bg4);border-radius:3px;overflow:hidden;">
                <div style="width:${N}%;height:100%;background:${N>80?"var(--red)":N>50?"var(--orange)":"var(--green)"};border-radius:3px;"></div>
            </div>
        </div>
    `;const le=c/d*100;if(R+=`
        <div class="tracker-item" style="flex:1;min-width:80px;max-width:140px;">
            <div style="display:flex;justify-content:space-between;font-size:0.75rem;">
                <span>🩸 Harm</span>
                <span>${c}/${d}</span>
            </div>
            <div style="width:100%;height:5px;background:var(--bg4);border-radius:3px;overflow:hidden;">
                <div style="width:${le}%;height:100%;background:${le>80?"var(--red)":le>50?"var(--orange)":"var(--gold)"};border-radius:3px;"></div>
            </div>
        </div>
    `,R+=`
        <div class="tracker-item" style="flex:0 0 auto;padding:0 0.2rem;">
            <div style="display:flex;justify-content:space-between;font-size:0.75rem;">
                <span>⭐ XP</span>
                <span>${m}</span>
            </div>
        </div>
    `,r==="runekeeper"||r==="invoker"){const j=f>0?Math.min(100,u/f*100):0;R+=`
            <div class="tracker-item" style="flex:1;min-width:80px;max-width:140px;">
                <div style="display:flex;justify-content:space-between;font-size:0.75rem;">
                    <span>⛓️ Obligation</span>
                    <span>${u}/${f}</span>
                </div>
                <div style="width:100%;height:5px;background:var(--bg4);border-radius:3px;overflow:hidden;">
                    <div style="width:${j}%;height:100%;background:${j>80?"var(--red)":j>60?"var(--orange)":"var(--gold)"};border-radius:3px;"></div>
                </div>
            </div>
        `}if(r==="cantor"){const j=y>0?Math.min(100,h/y*100):0;R+=`
            <div class="tracker-item" style="flex:1;min-width:80px;max-width:140px;">
                <div style="display:flex;justify-content:space-between;font-size:0.75rem;">
                    <span>🎵 Corruption</span>
                    <span>${h}/${y}</span>
                </div>
                <div style="width:100%;height:5px;background:var(--bg4);border-radius:3px;overflow:hidden;">
                    <div style="width:${j}%;height:100%;background:${j>80?"var(--purple)":"var(--blue)"};border-radius:3px;"></div>
                </div>
            </div>
        `,H>0?R+=`
                <div class="tracker-item" style="flex:0 0 auto;padding:0 0.2rem;">
                    <div style="display:flex;justify-content:space-between;font-size:0.75rem;align-items:center;gap:0.2rem;">
                        <span>🌸 Blooms</span>
                        <span style="font-weight:600;color:${H>=7?"var(--gold)":"var(--text2)"};">${H}${H>=7?" ✨Fugal":""}</span>
                    </div>
                </div>
            `:R+=`
                <div class="tracker-item" style="flex:0 0 auto;padding:0 0.2rem;">
                    <div style="display:flex;justify-content:space-between;font-size:0.75rem;align-items:center;gap:0.2rem;">
                        <span>🌸 Blooms</span>
                        <span style="color:var(--text3);">0</span>
                    </div>
                </div>
            `}if(r==="summoner"){const j=$>0?Math.min(100,b/$*100):0;R+=`
            <div class="tracker-item" style="flex:1;min-width:80px;max-width:140px;">
                <div style="display:flex;justify-content:space-between;font-size:0.75rem;">
                    <span>👁️ Leash</span>
                    <span>${b}/${$}</span>
                </div>
                <div style="width:100%;height:5px;background:var(--bg4);border-radius:3px;overflow:hidden;">
                    <div style="width:${j}%;height:100%;background:${j>80?"var(--red)":"var(--gold)"};border-radius:3px;"></div>
                </div>
                ${L>0?`<div style="font-size:0.6rem;color:var(--text3);">${L} spirit${L>1?"s":""} bound</div>`:""}
            </div>
        `}if(r==="psion"){const j=w>0?Math.min(100,g/w*100):0;R+=`
            <div class="tracker-item" style="flex:1;min-width:80px;max-width:140px;">
                <div style="display:flex;justify-content:space-between;font-size:0.75rem;">
                    <span>🧠 Mental Strain</span>
                    <span>${g}/${w}</span>
                </div>
                <div style="width:100%;height:5px;background:var(--bg4);border-radius:3px;overflow:hidden;">
                    <div style="width:${j}%;height:100%;background:${j>80?"var(--red)":"var(--blue)"};border-radius:3px;"></div>
                </div>
            </div>
        `}if(r==="witch"){const j=Math.min(100,T*20);R+=`
            <div class="tracker-item" style="flex:1;min-width:70px;max-width:120px;">
                <div style="display:flex;justify-content:space-between;font-size:0.75rem;">
                    <span>🌑 Shadow</span>
                    <span>${T}</span>
                </div>
                <div style="width:100%;height:5px;background:var(--bg4);border-radius:3px;overflow:hidden;">
                    <div style="width:${j}%;height:100%;background:var(--purple);border-radius:3px;"></div>
                </div>
            </div>
        `;const pt=Math.min(100,S*20);R+=`
            <div class="tracker-item" style="flex:1;min-width:70px;max-width:120px;">
                <div style="display:flex;justify-content:space-between;font-size:0.75rem;">
                    <span>😞 Shame</span>
                    <span>${S}</span>
                </div>
                <div style="width:100%;height:5px;background:var(--bg4);border-radius:3px;overflow:hidden;">
                    <div style="width:${pt}%;height:100%;background:var(--red);border-radius:3px;"></div>
                </div>
            </div>
        `;const mt=Math.min(100,x*20);R+=`
            <div class="tracker-item" style="flex:1;min-width:70px;max-width:120px;">
                <div style="display:flex;justify-content:space-between;font-size:0.75rem;">
                    <span>🌀 Identity</span>
                    <span>${x}</span>
                </div>
                <div style="width:100%;height:5px;background:var(--bg4);border-radius:3px;overflow:hidden;">
                    <div style="width:${mt}%;height:100%;background:${x>=4?"var(--red)":"var(--gold)"};border-radius:3px;"></div>
                </div>
                ${x>=4?'<div style="font-size:0.55rem;color:var(--red);">⚠️ Threshold!</div>':""}
            </div>
        `,z>0&&(R+=`
                <div class="tracker-item" style="flex:0 0 auto;padding:0 0.2rem;">
                    <div style="display:flex;justify-content:space-between;font-size:0.75rem;">
                        <span>⏳ Promises</span>
                        <span>${z}</span>
                    </div>
                </div>
            `)}if(r==="monk"||t.monasticTradition){const j={entering:"🌬️ Entering",holding:"🫁 Holding",releasing:"💨 Releasing",empty:"🌌 Empty"}[B]||B;R+=`
            <div class="tracker-item" style="flex:0 0 auto;padding:0 0.2rem;">
                <div style="display:flex;justify-content:space-between;font-size:0.75rem;">
                    <span>🫁 Breath</span>
                    <span>${j}</span>
                </div>
            </div>
        `,V.length>0&&(R+=`
                <div class="tracker-item" style="flex:0 0 auto;padding:0 0.2rem;">
                    <div style="display:flex;justify-content:space-between;font-size:0.75rem;">
                        <span>⚡ Scars</span>
                        <span>${V.length}</span>
                    </div>
                </div>
            `),P>0&&(R+=`
                <div class="tracker-item" style="flex:0 0 auto;padding:0 0.2rem;">
                    <div style="display:flex;justify-content:space-between;font-size:0.75rem;">
                        <span>⚠️ Corruption</span>
                        <span>Tier ${P}</span>
                    </div>
                </div>
            `),I>0&&(R+=`
                <div class="tracker-item" style="flex:0 0 auto;padding:0 0.2rem;">
                    <div style="display:flex;justify-content:space-between;font-size:0.75rem;">
                        <span>🧘 Progress</span>
                        <span>${I}</span>
                    </div>
                </div>
            `)}R+="</div>",e.innerHTML=R}var Rn="./data/bestiary.json",Se={I:{label:"Echo / Wisp",color:"#6baa7a",leash:3,description:"Faint spirits, recent memories, the barely-there. Low risk, low reward.",icon:"🌫️"},II:{label:"Anchor / Wight",color:"#d4af37",leash:4,description:"Bound to a place or object. Reliable, but territorial.",icon:"🔗"},III:{label:"Poltergeist / Ravager",color:"#d97a5a",leash:5,description:"Restless and hungry. Powerful, but the leash is short.",icon:"💥"},IV:{label:"Demon / Possessor",color:"#c45a5a",leash:6,description:"Ancient and malevolent. They always have an angle.",icon:"👿"},V:{label:"Archfae / Duke",color:"#b84a8a",leash:8,description:"Princes of the Gloaming. The leash is a courtesy they extend.",icon:"👑"}},X={CALM:{label:"Calm",color:"var(--green)",emoji:"😌",threshold:0},CONTENT:{label:"Content",color:"#8bc34a",emoji:"🙂",threshold:.25},RESTLESS:{label:"Restless",color:"var(--orange)",emoji:"😐",threshold:.5},STRAINED:{label:"Strained",color:"#e67e22",emoji:"😰",threshold:.7},REBELLIOUS:{label:"Rebellious",color:"var(--red)",emoji:"😤",threshold:.85},BREAKING:{label:"Breaking Free",color:"#8b0000",emoji:"💥",threshold:1}};function We(e,t){if(t<=0)return X.CALM;const r=e/t;return r>=1?X.BREAKING:r>=.85?X.REBELLIOUS:r>=.7?X.STRAINED:r>=.5?X.RESTLESS:r>=.25?X.CONTENT:X.CALM}Object.fromEntries(Object.entries(Se).map(([e,t])=>[e,t.leash]));var An=[{value:"boon",label:"1 Boon"},{value:"fatigue",label:"1 Fatigue"},{value:"memory",label:"Memory"}];function Q(e){typeof window.sendToVTT=="function"?window.sendToVTT(e,"System",{isHTML:!0}):console.warn("[Summoning] VTT not available — message not sent.")}function J(e,t,r,n,o,i=""){return`
        <div style="
            background:var(--bg2);
            border-radius:var(--radius);
            padding:0.5rem 0.8rem;
            border:1px solid var(--border);
            border-left:4px solid var(--gold);
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            max-width: 450px;
            margin:0.1rem 0;
            font-family: inherit;
        ">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.2rem;">
                <div style="display:flex;align-items:center;gap:0.3rem;">
                    <span style="font-size:1.2rem;">${p(r||"🌀")}</span>
                    <span style="font-weight:700;font-size:1.05rem;color:var(--gold);">${p(e)}</span>
                </div>
                <span style="font-size:0.65rem;color:var(--text3);">${p(t)}</span>
            </div>
            ${n?`<div style="font-size:0.8rem;color:var(--text);margin-top:0.2rem;line-height:1.4;">${ut(n)}</div>`:""}
            ${o?`<div style="font-size:0.7rem;color:var(--text3);margin-top:0.15rem;">${ut(o)}</div>`:""}
            ${i?`<div style="font-size:0.65rem;color:var(--text3);margin-top:0.1rem;">${ut(i)}</div>`:""}
        </div>
    `}function he(e){if(e==null)return"";if(typeof e=="string")return e;if(typeof e=="number"||typeof e=="boolean")return String(e);if(Array.isArray(e))return e.map(t=>he(t)).join(", ");if(typeof e=="object"){if(e.name)return he(e.name);if(e.label)return he(e.label);if(e.summary)return he(e.summary);if(e.lore)return he(e.lore);try{return JSON.stringify(e)}catch{return"[object]"}}return String(e)}function ut(e){return e?p(e).replace(/\n/g,"<br>"):""}function Mt(e){if(e.class)return e.class;if(e.tier)return e.tier;const t=(e.name||"").toLowerCase();return t.includes("echo")||t.includes("wisp")?"I":t.includes("anchor")||t.includes("wight")||t.includes("shade")?"II":t.includes("poltergeist")||t.includes("wraith")||t.includes("ghoul")?"III":t.includes("demon")||t.includes("possessor")||t.includes("fiend")?"IV":t.includes("archfae")||t.includes("duke")||t.includes("prince")?"V":"II"}function gr(e){if(e.tl!==void 0&&e.tl!==null)return parseInt(e.tl,10);const t=Mt(e),r=parseInt(t,10);return isNaN(r)?2:r}function Mn(e){const t=(e.name||"").toLowerCase();return e.icon?e.icon:t.includes("wolf")||t.includes("hound")?"🐺":t.includes("raven")||t.includes("crow")?"🐦‍⬛":t.includes("serpent")||t.includes("snake")||t.includes("worm")?"🐍":t.includes("drake")||t.includes("wyrm")?"🐉":t.includes("ghoul")||t.includes("wraith")||t.includes("shade")?"👻":t.includes("demon")||t.includes("fiend")||t.includes("ravager")?"👿":t.includes("fae")||t.includes("court")||t.includes("thorn")?"🧚":t.includes("giant")||t.includes("ogre")||t.includes("troll")?"🗿":t.includes("goblin")||t.includes("hobgoblin")||t.includes("bugbear")?"👺":t.includes("vampire")||t.includes("draugr")?"🧛":t.includes("lycanthrope")||t.includes("sea-wolf")||t.includes("sky-hound")?"🐾":t.includes("dryad")||t.includes("bramble")?"🌿":t.includes("bell")||t.includes("wight")?"🔔":t.includes("elemental")||t.includes("dust")?"🌪️":t.includes("selkie")||t.includes("sea")?"🦭":t.includes("ancestor")||t.includes("bone")?"🦴":t.includes("hearth")||t.includes("home")?"🏠":t.includes("lamp")||t.includes("light")||t.includes("beacon")?"🪔":"🌀"}var ge=null;async function hr(){if(ge)return ge;try{const e=await fetch(Rn);if(e.ok){const t=await e.json();return Array.isArray(t)?ge=t.map(r=>{const n=Object.keys(r);if(n.length===1){const o=n[0],i=r[o];return{id:o.toLowerCase().replace(/[^a-z0-9]/g,"-"),name:o,...i}}else return r}):typeof t=="object"?ge=Object.entries(t).map(([r,n])=>({id:r.toLowerCase().replace(/[^a-z0-9]/g,"-"),name:r,...n})):ge=[],ge}}catch{console.warn("Could not load bestiary, using built-in spirits.")}return ge=Bn(),ge}function Bn(){return[{id:"wolf-ancestor",name:"Wolf-Ancestor",class:"II",icon:"🐺",nature:"Ancestral",summary:"Ancestral, protective, prideful. Values honesty and courage in battle.",lore:"A gray wolf the size of a pony, with eyes that reflect scenes from the summoner's childhood. It speaks in growls that form words and judges your worth by your pack.",services:["Tracking across any terrain","Guarding camps","Teaching forgotten battle-songs","Sensing oath-breakers"],price:"Uphold the honor of the clan. Any cowardice breaks the bond.",connections:["Ykrul","Violet Steppe"],signs:["Wolf tracks that circle three times","Howls at the edge of camp","Eyes glowing in the dark"]}].map(e=>{const t=e.class||"II",r=parseInt(t,10);return{...e,tl:isNaN(r)?2:r}})}function Ln(e,t){if(!e||e.trim()==="")return t;const r=e.toLowerCase().trim();return t.filter(n=>{const o=he(n.name||"").toLowerCase(),i=he(n.summary||"").toLowerCase(),a=he(n.lore||"").toLowerCase(),s=(n.connections||[]).map(d=>d.toLowerCase()).join(" "),c=(n.services||[]).map(d=>d.toLowerCase()).join(" ");return o.includes(r)||i.includes(r)||a.includes(r)||s.includes(r)||c.includes(r)})}function En(e,t){return!t||t==="all"?e:e.filter(r=>Mt(r)===t)}function In(e,t){return!t||t==="all"?e:e.filter(r=>(r.nature||"").toLowerCase()===t.toLowerCase())}function Fn(e,t){return!t||t==="all"?e:e.filter(r=>(r.connections||[]).some(n=>n.toLowerCase().includes(t.toLowerCase())))}function jn(e,t){if(!t||t==="all")return e;const r=parseInt(t,10);return e.filter(n=>gr(n)===r)}async function re(e){const t=v();if(!t||t.magicPath!=="summoner"){e.innerHTML=`
            <div class="panel" style="padding:0.5rem;text-align:center;color:var(--text3);">
                <div style="font-size:1.5rem;">👁️</div>
                <p>Summoning interface is only for Summoners.</p>
                <p style="font-size:0.85rem;">Select a character with the Summoner magic path.</p>
            </div>
        `;return}const r=t.boundSpirits||[],n=t.leash||0,o=t.leashMax||4,i=(await hr()).filter(g=>(g.tl||0)<4),a=sessionStorage.getItem("fates-edge-summoner-search")||"",s=sessionStorage.getItem("fates-edge-summoner-filter-class")||"all",c=sessionStorage.getItem("fates-edge-summoner-filter-nature")||"all",d=sessionStorage.getItem("fates-edge-summoner-filter-region")||"all",m=sessionStorage.getItem("fates-edge-summoner-filter-tl")||"all";let u=Ln(a,i);u=En(u,s),u=In(u,c),u=Fn(u,d),u=jn(u,m);const f=["all",...new Set(i.map(g=>g.nature||"Unknown").filter(Boolean))],h=["all",...new Set(i.flatMap(g=>g.connections||[]).filter(Boolean))],y=[1,2,3],b=We(n,o),$=An.map(g=>`<option value="${g.value}">${g.label}</option>`).join("");e.innerHTML=`
        <div class="summoning-container" style="display:flex;flex-direction:column;gap:0.5rem;">

            <!-- ─── Header ─────────────────────────────────────── -->
            <div class="summoning-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.3rem;border-bottom:2px solid var(--border);padding-bottom:0.3rem;background:linear-gradient(135deg, var(--bg2) 0%, var(--bg1) 100%);border-radius:var(--radius) var(--radius) 0 0;padding:0.3rem 0.8rem;">
                <div style="display:flex;align-items:center;gap:0.4rem;">
                    <span style="font-size:1.4rem;">👁️</span>
                    <div>
                        <span style="font-weight:600;font-size:1.05rem;color:var(--gold);">The Opened Door</span>
                        <span style="font-size:0.7rem;color:var(--text3);margin-left:0.3rem;">${r.length} bound</span>
                    </div>
                </div>
                <div style="display:flex;gap:0.3rem;flex-wrap:wrap;align-items:center;">
                    <select id="summoner-bind-cost-select" style="font-size:0.65rem;background:var(--bg3);border:1px solid var(--border);border-radius:4px;padding:0.1rem 0.3rem;">
                        ${$}
                    </select>
                    <button class="btn btn-sm btn-gold" onclick="window.summonerBindRitualFromSelect()">🔮 Bind Spirit</button>
                    <button class="btn btn-sm btn-secondary" onclick="window.summonerRefresh()">🔄 Refresh</button>
                </div>
            </div>

            <!-- ─── Leash Track ────────────────────────────────── -->
            <div class="summoning-leash" style="background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;border-left:4px solid ${b.color};">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.2rem;font-size:0.8rem;">
                    <div style="display:flex;align-items:center;gap:0.3rem;">
                        <span style="font-size:1.2rem;">${b.emoji}</span>
                        <span style="color:${b.color};font-weight:600;">${b.label}</span>
                        <span style="color:var(--text3);">🔗 ${n}/${o}</span>
                    </div>
                    <div style="display:flex;gap:0.2rem;align-items:center;">
                        <button class="btn btn-xs btn-secondary" onclick="window.summonerTickLeash(1)">+1</button>
                        <button class="btn btn-xs btn-secondary" onclick="window.summonerTickLeash(-1)">−1</button>
                        <select id="summoner-negotiate-offer-select" style="font-size:0.6rem;background:var(--bg3);border:1px solid var(--border);border-radius:4px;padding:0.05rem 0.2rem;">
                            ${$}
                        </select>
                        <button class="btn btn-xs btn-gold" onclick="window.summonerNegotiateFromSelect()" style="font-size:0.6rem;">🤝 Negotiate</button>
                        <button class="btn btn-xs btn-ghost" onclick="window.summonerClearLeash()" style="color:var(--red);">✕</button>
                    </div>
                </div>
                <div style="width:100%;height:8px;background:var(--bg4);border-radius:4px;overflow:hidden;margin-top:0.1rem;">
                    <div style="width:${Math.min(100,n/o*100)}%;height:100%;background:${b.color};border-radius:4px;transition:width 0.3s ease;"></div>
                </div>
                ${n>=o?`
                    <div style="color:var(--red);font-size:0.75rem;margin-top:0.1rem;font-weight:600;animation:pulse 1s infinite;">
                        ⚠️ THE LEASH IS BROKEN! The spirit will act on its nature!
                    </div>
                `:n>=o*.8?`
                    <div style="color:var(--orange);font-size:0.7rem;margin-top:0.1rem;">
                        ⚠️ The leash is straining. The spirit grows restless.
                    </div>
                `:""}
            </div>

            <!-- ─── Bestiary Browser ───────────────────────────── -->
            <div class="summoning-bestiary" style="background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;border:1px solid var(--border);">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.2rem;margin-bottom:0.2rem;">
                    <span style="font-size:0.85rem;font-weight:600;color:var(--gold);">📖 Bestiary (${u.length})</span>
                    <div style="display:flex;gap:0.2rem;flex-wrap:wrap;font-size:0.65rem;">
                        <input type="text" id="summoner-search" placeholder="Search..." value="${p(a)}" style="background:var(--bg3);color:var(--text);border:1px solid var(--border);border-radius:4px;padding:0.1rem 0.3rem;width:100px;" />
                        <select id="summoner-class-filter" style="background:var(--bg3);color:var(--text);border:1px solid var(--border);border-radius:4px;padding:0.1rem 0.3rem;">
                            <option value="all" ${s==="all"?"selected":""}>All Classes</option>
                            ${Object.entries(Se).map(([g,w])=>`<option value="${g}" ${s===g?"selected":""}>${w.icon} ${w.label}</option>`).join("")}
                        </select>
                        <select id="summoner-nature-filter" style="background:var(--bg3);color:var(--text);border:1px solid var(--border);border-radius:4px;padding:0.1rem 0.3rem;max-width:100px;">
                            ${f.map(g=>`<option value="${p(g)}" ${c===g?"selected":""}>${g==="all"?"All Natures":p(g)}</option>`).join("")}
                        </select>
                        <select id="summoner-region-filter" style="background:var(--bg3);color:var(--text);border:1px solid var(--border);border-radius:4px;padding:0.1rem 0.3rem;max-width:100px;">
                            ${h.map(g=>`<option value="${p(g)}" ${d===g?"selected":""}>${g==="all"?"All Regions":p(g)}</option>`).join("")}
                        </select>
                        <select id="summoner-tl-filter" style="background:var(--bg3);color:var(--text);border:1px solid var(--border);border-radius:4px;padding:0.1rem 0.3rem;max-width:80px;">
                            <option value="all" ${m==="all"?"selected":""}>All TL</option>
                            ${y.map(g=>`<option value="${g}" ${m===String(g)?"selected":""}>TL ${g}</option>`).join("")}
                        </select>
                    </div>
                </div>
                <div class="bestiary-list" style="max-height:200px;overflow-y:auto;display:flex;flex-direction:column;gap:0.2rem;">
                    ${u.length===0?`
                        <div style="text-align:center;color:var(--text3);padding:0.5rem 0;font-size:0.8rem;">
                            No spirits found matching your criteria.
                        </div>
                    `:u.map(g=>{}).join("")}
                </div>
            </div>

            <!-- ─── Bound Spirits ───────────────────────────────── -->
            <div class="summoning-bound" style="background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;border:1px solid var(--border);">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.2rem;">
                    <span style="font-size:0.85rem;font-weight:600;color:var(--gold);">🔗 Bound Spirits (${r.length})</span>
                    <div style="display:flex;gap:0.2rem;">
                        <button class="btn btn-xs btn-secondary" onclick="window.summonerReleaseAll()" style="color:var(--red);">Release All</button>
                    </div>
                </div>
                ${r.length===0?`
                    <div style="text-align:center;color:var(--text3);padding:0.5rem 0;font-size:0.8rem;">
                        No spirits bound. Browse the bestiary and click "Bind" to form a pact.
                    </div>
                `:r.map(g=>{}).join("")}
            </div>

            <!-- ─── Quick Reference ────────────────────────────── -->
            <div class="summoning-quickref" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:0.1rem;font-size:0.6rem;color:var(--text3);background:var(--bg2);border-radius:var(--radius);padding:0.15rem 0.3rem;border:1px solid var(--border);">
                <div>🔮 <strong>Call:</strong> 1 action (Wits+Presence vs Resist)</div>
                <div>🔗 <strong>Bind:</strong> 1 Boon or 1 Fatigue</div>
                <div>⚡ <strong>Command:</strong> Free (within nature); +1 Leash (against)</div>
                <div>🤝 <strong>Negotiate:</strong> Reduce Leash with offering</div>
                <div>🧹 <strong>Release:</strong> Wits+Presence vs Resist (peaceful)</div>
            </div>

        </div>
    `}window.summonerBindFromBestiaryWithCost=async function(e,t){const r=v();if(!r)return;const n=(await hr()).find(m=>(m.id||m.name)===e);if(!n){l("Spirit not found in bestiary.","error");return}const o=n.name||"Unnamed Spirit",i=Mt(n),a=Se[i]||Se.II,s=gr(n);if(s>=4){l(`"${o}" is TL ${s} and cannot be bound.`,"error");return}if((r.boundSpirits||[]).some(m=>m.bestiaryId===e||m.name===o)){l(`"${o}" is already bound.`,"warning");return}if(!["boon","fatigue","memory"].includes(t)){l("Invalid cost. Choose boon, fatigue, or memory.","error");return}let c="";if(t==="boon"){const m=r.boons||0;if(m<1){l("Not enough Boons!","error");return}r.boons=m-1,c="1 Boon"}else if(t==="fatigue"){const m=r.fatigue||0;if(m>=(r.attributes?.body||1)){l("Fatigue track full!","error");return}r.fatigue=m+1,c="1 Fatigue"}else c="A Memory";const d={id:Y("spirit_"),bestiaryId:e,name:o,icon:n.icon||Mn(n),class:i,nature:n.nature||"Unknown",services:n.services||[],price:n.price||"None",lore:n.lore||"",leashMax:a.leash||4,currentLeash:0,boundAt:Date.now(),commands:[]};r.boundSpirits||(r.boundSpirits=[]),r.boundSpirits.push(d),k({boundSpirits:r.boundSpirits,boons:r.boons,fatigue:r.fatigue}),l(`🔮 Bound "${o}"! The leash is set. (Paid with ${t})`,"success"),Q(J("Bound Spirit",o,d.icon||"🌀",`Bound to ${o} (${a.label})`,`Paid: ${c} · Leash: ${d.leashMax}`,`${n.nature||"Unknown"} nature · TL ${s}`)),re(document.getElementById("summoning-container"))};window.summonerBindRitualFromSelect=function(){const e=v();if(!e)return;const t=document.getElementById("summoner-bind-cost-select"),r=t?t.value:"boon",n=prompt("🔮 Spirit name:");if(!n)return;const o=prompt("Nature (Ancestral/Indigenous/Elemental/Vengeful/Fae/Shadow/Anchor):")||"Unknown",i=(prompt("Services (comma-separated):")||"").split(",").map(u=>u.trim()).filter(Boolean),a=prompt("Price (what you pay):")||"None",s=(prompt("Class (I-V, or leave blank for II):")||"II").toUpperCase(),c=Se[s]||Se.II;if(!["boon","fatigue","memory"].includes(r)){l("Invalid cost. Choose boon, fatigue, or memory.","error");return}let d="";if(r==="boon"){const u=e.boons||0;if(u<1){l("Not enough Boons!","error");return}e.boons=u-1,d="1 Boon"}else if(r==="fatigue"){const u=e.fatigue||0;if(u>=(e.attributes?.body||1)){l("Fatigue track full!","error");return}e.fatigue=u+1,d="1 Fatigue"}else d="A Memory";const m={id:Y("spirit_"),name:n,icon:"🌀",class:s,nature:o,services:i,price:a,leashMax:c.leash||4,currentLeash:0,boundAt:Date.now(),commands:[],custom:!0};e.boundSpirits||(e.boundSpirits=[]),e.boundSpirits.push(m),k({boundSpirits:e.boundSpirits,boons:e.boons,fatigue:e.fatigue}),l(`🔮 Bound "${n}" (${c.label})`,"success"),Q(J("Ritual Binding",n,"🌀",`Ritually bound ${n} (${c.label})`,`Paid: ${d} · Leash: ${m.leashMax}`,`${o} nature · Custom pact`)),re(document.getElementById("summoning-container"))};window.summonerTickLeash=function(e=1){const t=v();if(!t)return;const r=t.leash||0,n=Math.max(0,r+e);t.leash=n,k({leash:t.leash});const o=t.leashMax||4;We(n,o),n>=o?(l("💥 LEASH BROKEN! The spirit acts on its nature!","warning"),Q(J("💥 Leash Broken","All Spirits","💥","The leash snaps! Spirits act on their nature.",`Leash: ${n}/${o}`,"⚠️ Consequences are imminent."))):n>=o*.8?(l("⚠️ Leash is straining! The spirit grows restless.","warning"),Q(J("⚠️ Leash Straining","All Spirits","⚠️","The leash is under tension. The spirits grow restless.",`Leash: ${n}/${o}`,"Negotiate to reduce tension."))):n<r&&Q(J("Leash Relaxed","All Spirits","😌","The tension on the leash has eased.",`Leash: ${n}/${o}`,"The spirits are more content.")),re(document.getElementById("summoning-container"))};window.summonerNegotiateFromSelect=function(){const e=v();if(!e)return;const t=document.getElementById("summoner-negotiate-offer-select");if(!t)return;const r=t.value;if(!["boon","fatigue","memory"].includes(r)){l("Invalid offer. Choose boon, fatigue, or memory.","error");return}let n=!1,o="";if(r==="boon"){const a=e.boons||0;if(a<1){l("Not enough Boons!","error");return}e.boons=a-1,n=!0,o="1 Boon"}else if(r==="fatigue"){const a=e.fatigue||0;if(a>=(e.attributes?.body||1)){l("Fatigue track full!","error");return}e.fatigue=a+1,n=!0,o="1 Fatigue"}else n=!0,o="A Memory",l("🧠 The spirit accepts your memory. It will carry it into the dark.","info");if(!n)return;const i=e.leash||0;e.leash=Math.max(0,Math.floor(i/2)),k({leash:e.leash,boons:e.boons,fatigue:e.fatigue}),l(`🤝 Leash reduced to ${e.leash}/${e.leashMax||4}.`,"success"),Q(J("🤝 Negotiation","Spirits","🤝","An offering has been accepted. The leash loosens.",`Offered: ${o} · Leash: ${e.leash}/${e.leashMax||4}`,"The spirits are more at ease.")),re(document.getElementById("summoning-container"))};window.summonerClearLeash=function(){const e=v();if(!e||!confirm("Clear all leash tension? This may anger the spirit."))return;const t=e.leash||0;e.leash=0,k({leash:e.leash}),l("Leash cleared.","info"),Q(J("🧹 Leash Cleared","All Spirits","🧹","All leash tension has been cleared.",`Old leash: ${t}`,"The spirits are now calm.")),re(document.getElementById("summoning-container"))};window.summonerTickSpiritLeash=function(e,t=1){const r=v();if(!r)return;const n=r.boundSpirits.find(a=>a.id===e);if(!n)return l("Spirit not found.","error");const o=n.currentLeash||0;n.currentLeash=Math.max(0,o+t);const i=n.leashMax||4;We(n.currentLeash,i),n.currentLeash>=i&&(l(`💥 "${n.name}" breaks the leash! It acts on its nature!`,"warning"),Q(J("💥 Spirit Breaks Free",n.name,n.icon||"🌀",`"${n.name}" has broken the leash!`,`Leash: ${n.currentLeash}/${i}`,"The spirit acts on its nature."))),k({boundSpirits:r.boundSpirits}),re(document.getElementById("summoning-container"))};window.summonerCommandSpirit=function(e){const t=v();if(!t)return;const r=t.boundSpirits.find(u=>u.id===e);if(!r)return l("Spirit not found.","error");const n=(r.services||[]).join(`
• `),o=prompt(`⚡ Command "${r.name}" (${r.nature||"Unknown"})

Services:
• ${n||"None listed"}

Enter your command:`,"Scout ahead");if(!o)return;const i=confirm(`Is this command AGAINST "${r.nature}" nature? (Click Yes if it goes against their nature)`);i?(r.currentLeash=(r.currentLeash||0)+1,l("⚡ Command issued against nature. Leash +1.","warning"),r.currentLeash>=(r.leashMax||4)&&l(`💥 "${r.name}" breaks the leash!`,"warning")):l(`✅ "${r.name}" follows your command.`,"success"),r.commands||(r.commands=[]),r.commands.push({command:o,timestamp:Date.now(),againstNature:i}),k({boundSpirits:t.boundSpirits});const a=r.leashMax||4,s=We(r.currentLeash||0,a),c=`Command: "${o}"`,d=`Against nature? ${i?"Yes (Leash +1)":"No"} · Leash: ${r.currentLeash||0}/${a}`,m=`Mood: ${s.label}`;Q(J("⚡ Spirit Command",r.name,r.icon||"🌀",c,d,m)),re(document.getElementById("summoning-container"))};window.summonerReleaseSpirit=function(e){const t=v();if(!t)return;const r=t.boundSpirits.find(c=>c.id===e);if(!r)return;const n=We(r.currentLeash||0,r.leashMax||4),o=n===X.BREAKING||n===X.REBELLIOUS?`⚠️ WARNING: This spirit is ${n.label.toLowerCase()}! Releasing it may have consequences.`:`The spirit is ${n.label.toLowerCase()}. It will depart peacefully.`;if(!confirm(`Release "${r.name}"?

${o}`))return;const i=r.name,a=r.icon||"🌀",s=n===X.BREAKING||n===X.REBELLIOUS;t.boundSpirits=t.boundSpirits.filter(c=>c.id!==e),k({boundSpirits:t.boundSpirits}),s?l(`💥 "${i}" is released in anger! The spirit will remember this.`,"error"):l(`🌀 "${i}" is released peacefully.`,"info"),Q(J("🧹 Spirit Released",i,a,s?"Released in anger!":"Released peacefully.",`Mood before release: ${n.label}`,s?"⚠️ The spirit may return. It remembers.":"The pact is ended.")),re(document.getElementById("summoning-container"))};window.summonerReleaseAll=function(){const e=v();if(!e)return;if(!e.boundSpirits||e.boundSpirits.length===0){l("No spirits to release.","info");return}if(!confirm("Release ALL bound spirits? This will break all pacts."))return;const t=e.boundSpirits.length,r=e.boundSpirits.map(n=>n.name).join(", ");e.boundSpirits=[],k({boundSpirits:e.boundSpirits}),l("All spirits released.","info"),Q(J("🧹 All Spirits Released",`${t} spirits`,"🌀",`Released: ${r}`,`Total: ${t}`,"All pacts are severed.")),re(document.getElementById("summoning-container"))};window.summonerViewSpirit=async function(e){};window.summonerViewBoundSpirit=function(e){};window.summonerRefresh=function(){const e=document.getElementById("summoning-container");e&&re(e),l("🔄 Summoning refreshed.","info")};window.summonerBindFromBestiary=async function(e){await window.summonerBindFromBestiaryWithCost(e,"boon")};window.summonerBindRitual=function(){document.getElementById("summoner-bind-cost-select")?window.summonerBindRitualFromSelect():l("Please refresh the panel to use the dropdown.","info")};window.summonerNegotiateLeash=function(){document.getElementById("summoner-negotiate-offer-select")?window.summonerNegotiateFromSelect():l("Please refresh the panel to use the dropdown.","info")};var{loadPatronData:br}=De,vr=[{id:"steady-hand",name:"Steady Hand",effect:"Remove 1 Fatigue from yourself or a touched ally.",limit:"Once per scene"},{id:"salt-line",name:"Salt Line",effect:"Pour a line of salt; spirits must test Spirit+Resolve (DV 3) to cross.",limit:"Once per scene"},{id:"hearth-sense",name:"Hearth-Sense",effect:"Ask the GM one yes/no question about a threshold, boundary, or debt.",limit:"Once per scene"},{id:"unlit-candle",name:"The Unlit Candle",effect:"Extinguish a light source; create dim light or darkness in Near range.",limit:"Once per session"},{id:"knot-of-favor",name:"Knot of Favor",effect:"Tie a knot; you and allies gain +1 die to one type of roll for the scene.",limit:"Once per scene"},{id:"warm-hand",name:"Warm Hand",effect:"Touch someone; their next physical action gains +1 die or suffers -1 die.",limit:"Once per scene"},{id:"counting-eighth",name:"Counting the Eighth",effect:"Whisper a number (1-8); if GM's SB count matches, gain +2 dice.",limit:"Once per scene"},{id:"threshold-whisper",name:"Threshold Whisper",effect:"Learn the nature of a threshold (door, bridge, boundary) with a touch.",limit:"Once per scene"},{id:"red-thread",name:"Red Thread",effect:"Tie a thread on a door; next person crossing forgets why they entered (Resist DV 2).",limit:"Once per session"},{id:"cup-mark",name:"Cup-Mark",effect:"Leave a cup-mark on a stone; return before dawn to ignore one minor social complication.",limit:"Once per session"}],Hn={shadow:{label:"Shadow",icon:"🌑",max:5,warningAt:3,color:"var(--purple)"},shame:{label:"Shame",icon:"😞",max:5,warningAt:3,color:"var(--red)"},identityStrain:{label:"Identity Strain",icon:"🌀",max:5,warningAt:3,color:"var(--gold)"}},Yt=null,Te=!1,Ce=!1,ze=!1,Pe=!1,$e=!1;function Dn(e){Yt!==e.id&&(Te=!1,Ce=!1,ze=!1,Pe=!1,$e=!1,Yt=e.id)}function Nn(){const e=document.querySelector(".witchcraft-container");return e?e.parentElement:document.getElementById("spellcraft-content")}async function W(){const e=Nn();e?await $r(e):ue(()=>import("./spellcraft.BTrFBpcK.js").then(t=>{t.renderActiveTabContent&&t.renderActiveTabContent()}),[])}function yr(e){const t=E();if(t.patrons?.cosmic){const r=t.patrons.cosmic.find(n=>n.id===e);if(r&&r.witchcraft)return{patron:r,witchcraft:r.witchcraft}}if(t.patrons?.terrestrial){const r=t.patrons.terrestrial.find(n=>n.id===e);if(r&&r.witchcraft)return{patron:r,witchcraft:r.witchcraft}}if(t.patrons?.religions){for(const r of t.patrons.religions)if(r.orders){const n=r.orders.find(o=>o.id===e);if(n&&n.witchcraft)return{patron:n,witchcraft:n.witchcraft,religion:r.name}}}return null}function wr(){const e=E(),t=[];if(e.patrons?.cosmic)for(const r of e.patrons.cosmic)r.witchcraft&&t.push({patronId:r.id,patronName:r.name||r.title||r.id,patronIcon:r.icon||"🧙",witchcraft:r.witchcraft,source:"cosmic"});if(e.patrons?.terrestrial)for(const r of e.patrons.terrestrial)r.witchcraft&&t.push({patronId:r.id,patronName:r.name||r.title||r.id,patronIcon:r.icon||"🏛️",witchcraft:r.witchcraft,source:"terrestrial"});if(e.patrons?.religions){for(const r of e.patrons.religions)if(r.orders)for(const n of r.orders)n.witchcraft&&t.push({patronId:n.id,patronName:n.name||n.id,patronIcon:n.icon||r.icon||"⛪",witchcraft:n.witchcraft,source:"religion",religion:r.name})}return t}var On=[{icon:"🔥",label:"Free Caster",blurb:"Raw TAGS grammar, no patron — pure will and improvisation."},{icon:"📖",label:"Runekeeper",blurb:"Bound to one patron via Thiasos or Codex; steady Rites."},{icon:"🔯",label:"Invoker",blurb:"Carries Symbols from multiple patrons; risks Cross-Resonance."},{icon:"🎵",label:"Cantor",blurb:"Sings a patron's Rites as Songs; Corruption blooms with Pushing."},{icon:"👁️",label:"Summoner",blurb:"Binds spirits from the Bestiary; manages the Leash."},{icon:"🌿",label:"Witch",blurb:"Hedge magic at Thresholds, paid in Shadow, Shame, Identity Strain."},{icon:"🧠",label:"Psion",blurb:"Mind-born power fueled by Mental Strain."},{icon:"🧘",label:"Monk",blurb:"Patron-optional path of Breath States and monastic Techniques."},{icon:"🦅",label:"Familiar Only",blurb:"A bonded companion without a full magic path."},{icon:"🍃",label:"Hedge Gifts",blurb:"Small universal gifts available to any character."}];function Wn(e){return`
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:0.4rem;text-align:left;margin-top:0.8rem;">
            ${On.map(t=>`
                <div style="padding:0.4rem 0.5rem;border-radius:var(--radius);background:var(--bg2);border:1px solid ${t.label===e?"var(--gold)":"var(--border)"};">
                    <div style="display:flex;align-items:center;gap:0.3rem;">
                        <span style="font-size:1.1rem;">${t.icon}</span>
                        <strong style="font-size:0.82rem;${t.label===e?"color:var(--gold);":""}">${t.label}</strong>
                    </div>
                    <div style="font-size:0.68rem;color:var(--text3);margin-top:0.15rem;line-height:1.3;">${t.blurb}</div>
                </div>
            `).join("")}
        </div>
    `}function it(e){return e.witch||(e.witch={}),e.witch}function at(e){const t=it(e);return t.prices||(t.prices={shadow:0,shame:0,identityStrain:0}),t.prices}function st(e){const t=it(e);return t.promiseTimers||(t.promiseTimers=[]),t.promiseTimers}function Bt(e){const t=it(e);return t.hedgeGifts||(t.hedgeGifts=[]),t.hedgeGifts}function xr(e){const t=it(e);return t.rituals||(t.rituals=[]),t.rituals}async function $r(e){const t=v();if(!t){e.innerHTML=`
            <div class="panel" style="padding:1rem;text-align:center;color:var(--text3);">
                <div style="font-size:2rem;">🧹</div>
                <p>Select a character to view their hedge magic.</p>
                <div style="margin-top:0.5rem;font-weight:600;color:var(--gold);">📚 Magic Paths Reference</div>
                ${Wn("Witch")}
            </div>
        `;return}Dn(t),await br();const r=t.magicPath==="witch",n=(t.talents||[]).some(g=>g.name==="Craft of the Hedge"||g.id==="craft-of-the-hedge"),o=r||n||(t.hedgeGifts||[]).length>0||(t.witch?.hedgeGifts||[]).length>0,i=t.patron,a=i?yr(i):null,s=at(t),c=st(t),d=Bt(t),m=xr(t),u=wr(),f=a?.witchcraft?.hedge_gifts||[],h=[...vr,...f],y=new Set,b=h.filter(g=>y.has(g.id)?!1:(y.add(g.id),!0)),$=s.identityStrain>=3;e.innerHTML=`
        <div class="witchcraft-container" style="display:flex;flex-direction:column;gap:0.6rem;">

            <!-- ─── Header ─────────────────────────────────────── -->
            <div class="witchcraft-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.3rem;border-bottom:2px solid var(--border);padding-bottom:0.3rem;background:linear-gradient(135deg, var(--bg2) 0%, var(--bg1) 100%);border-radius:var(--radius) var(--radius) 0 0;padding:0.3rem 0.8rem;">
                <div style="display:flex;align-items:center;gap:0.4rem;">
                    <span style="font-size:1.4rem;">🧹</span>
                    <div>
                        <span style="font-weight:600;font-size:1.05rem;color:var(--gold);">Hedge Magic</span>
                        <span style="font-size:0.7rem;color:var(--text3);margin-left:0.3rem;">${r?"Witch":o?"Hedge-Gifted":"Any character"}</span>
                        ${a?`<span style="font-size:0.6rem;color:var(--text3);">· ${a.patron.name}</span>`:""}
                    </div>
                </div>
                <div style="display:flex;gap:0.3rem;flex-wrap:wrap;">
                    ${o?`<button class="btn btn-sm btn-primary" onclick="window.witchQuickWork()">${Te?"✕ Cancel":"⚡ Quick Work"}</button>`:""}
                    <button class="btn btn-sm btn-ghost" onclick="window.witchRefresh()" title="Reloads patron data from disk, bypassing any cached copy">🔄</button>
                </div>
            </div>

            ${o?"":`
                <div style="font-size:0.7rem;color:var(--text3);background:var(--bg2);border:1px dashed var(--border);border-radius:var(--radius);padding:0.4rem 0.6rem;">
                    🌿 Learn the <strong>Craft of the Hedge</strong> talent (or walk the Witch path) to unlock Hedge Gifts, Quick Workings, Full Rituals, and the price tracks.
                    Looking for the ingredient/recipe crafting bench? It moved to its own <strong>Crafting</strong> page in the sidebar — open to every character regardless of path.
                </div>
            `}

            ${Te?Kn():""}

            <!-- ─── Price Tracks (Witches only) ────────────────── -->
            ${r?Xn(s,$):""}

            <!-- ─── Weaver Display (hedge-access only) ─────────── -->
            ${o?a?Gn(a,t):qn(u):""}

            <!-- ─── Hedge Gifts (hedge-access only) ─────────────── -->
            ${o?Vn(d,b):""}

            <!-- ─── Promise Timers (hedge-access only) ──────────── -->
            ${o?Yn(c):""}

            <!-- ─── Full Rituals (Witches only) ─────────────────── -->
            ${r?Zn(m):""}

            <!-- ─── Quick Reference ─────────────────────────────── -->
            ${o?`
                <div class="witchcraft-quickref" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:0.1rem;font-size:0.6rem;color:var(--text3);background:var(--bg2);border-radius:var(--radius);padding:0.15rem 0.3rem;border:1px solid var(--border);">
                    <div>🌿 <strong>Gifts:</strong> No-roll, limited scope</div>
                    <div>⚡ <strong>Quick:</strong> Single action, roll required</div>
                    ${r?"<div>🕯️ <strong>Ritual:</strong> Extended, lasting effects</div>":""}
                    <div>⏳ <strong>Timer:</strong> When full, price comes due</div>
                </div>
            `:""}

            ${o?`
                <!-- ─── The Gray Wanderer's Wisdom ──────────────────── -->
                <div class="witchcraft-wisdom" style="background:var(--bg2);border-radius:var(--radius);padding:0.2rem 0.5rem;border-left:4px solid var(--gold);font-size:0.7rem;color:var(--text3);font-style:italic;">
                    "${a?.witchcraft?.quote||"The hedge is what keeps the wolves from the flock. I am the one who tends the hedge."}"
                    <span style="display:block;text-align:right;font-size:0.6rem;color:var(--text2);">— The Gray Wanderer</span>
                </div>
            `:""}

        </div>
    `}function Gn(e,t){const r=e.patron,n=e.witchcraft,o=n.color||"#d4af37",i=r.icon||"🧙",a=r.name||r.title||"The Weaver",s=n.description||"A witch of the hedge.",c=n.signature_rite||"Unknown",d=n.hedge_gifts||[];return`
        <div class="witchcraft-weaver" style="background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;border-left:4px solid ${o};border:1px solid var(--border);">
            <div style="display:flex;align-items:center;gap:0.3rem;flex-wrap:wrap;">
                <span style="font-size:1.2rem;">${i}</span>
                <span style="font-weight:600;font-size:0.95rem;color:${o};">${a}</span>
                <span style="font-size:0.7rem;color:var(--text3);">${s}</span>
                ${e.religion?`<span style="font-size:0.6rem;color:var(--text3);">⛪ ${e.religion}</span>`:""}
            </div>
            ${n.lore?`<div style="font-size:0.75rem;color:var(--text2);margin:0.15rem 0;">${n.lore}</div>`:""}
            ${c?`<div style="font-size:0.75rem;color:var(--text2);"><strong>Signature Rite:</strong> ${c}</div>`:""}
            ${d.length>0?`
                <div style="display:flex;gap:0.3rem;font-size:0.65rem;color:var(--text3);flex-wrap:wrap;margin-top:0.1rem;">
                    ${d.map(m=>`<span>🌿 ${m.name}</span>`).join(" · ")}
                </div>
            `:""}
        </div>
    `}function qn(e){return`
        <div class="witchcraft-no-weaver" style="background:var(--bg2);border-radius:var(--radius);padding:0.5rem;text-align:center;color:var(--text3);border:1px dashed var(--border);">
            <div style="font-size:1.5rem;">🧙</div>
            <p>No weaver selected. Choose a patron who offers witchcraft.</p>
            <button class="btn btn-sm btn-primary" onclick="window.witchChooseWeaver()">${Pe?"Hide Weavers":"Choose Weaver"}</button>
            ${Pe?`
                <div style="display:flex;flex-direction:column;gap:0.2rem;margin-top:0.4rem;text-align:left;max-height:180px;overflow-y:auto;padding:0.2rem;">
                    ${e.length===0?`
                        <div style="font-size:0.7rem;color:var(--text3);padding:0.3rem;">No patrons with witchcraft found. Check your patron JSON files.</div>
                    `:e.map(t=>`
                        <button class="btn btn-xs btn-secondary" style="text-align:left;justify-content:flex-start;display:flex;align-items:center;gap:0.3rem;" onclick="window.witchSelectWeaver('${p(t.patronId)}')">
                            <span>${t.patronIcon}</span>
                            <span>${p(t.patronName)}</span>
                            <span style="color:var(--text3);font-size:0.6rem;">— ${p(t.witchcraft.name||"Witchcraft")}${t.religion?` · ${p(t.religion)}`:""}</span>
                        </button>
                    `).join("")}
                </div>
            `:""}
        </div>
    `}function _n(e){return`
        <div class="gift-item" style="display:flex;justify-content:space-between;align-items:center;padding:0.1rem 0.3rem;border-bottom:1px solid var(--border);font-size:0.75rem;">
            <div style="flex:1;min-width:0;">
                <span style="font-weight:600;">${p(e.name)}</span>
                <span style="font-size:0.65rem;color:var(--text3);">${p(e.effect)}</span>
                ${e.limit?`<span style="font-size:0.55rem;color:var(--text2);">(${e.limit})</span>`:""}
            </div>
            <button class="btn btn-xs btn-ghost" onclick="window.witchRemoveGift('${e.id||e.name}')" style="color:var(--red);font-size:0.6rem;">✕</button>
        </div>
    `}function Vn(e,t){return`
        <div class="witchcraft-gifts" style="background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;border:1px solid var(--border);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.2rem;flex-wrap:wrap;gap:0.2rem;">
                <span style="font-size:0.85rem;font-weight:600;color:var(--gold);">🌿 Hedge Gifts</span>
                <div style="display:flex;gap:0.2rem;align-items:center;">
                    <span style="font-size:0.6rem;color:var(--text3);">${e.length} learned</span>
                    <select id="witch-gift-select" style="font-size:0.6rem;background:var(--bg3);border:1px solid var(--border);border-radius:4px;padding:0.05rem 0.3rem;max-width:140px;">
                        ${t.map(r=>`<option value="${r.id}">${r.name}</option>`).join("")}
                    </select>
                    <button class="btn btn-xs btn-secondary" onclick="window.witchAddGiftFromSelect()">+ Add</button>
                </div>
            </div>
            <div style="display:flex;flex-direction:column;gap:0.15rem;max-height:200px;overflow-y:auto;">
                ${e.length===0?`
                    <div style="font-size:0.75rem;color:var(--text3);text-align:center;padding:0.5rem 0;">
                        No hedge gifts learned. Select a gift from the dropdown and click "Add".
                    </div>
                `:e.map(r=>_n(r)).join("")}
            </div>
        </div>
    `}function Un(e){const t=Math.min(100,(e.current||0)/(e.segments||4)*100),r=t>=100;return`
        <div class="timer-item" style="display:flex;justify-content:space-between;align-items:center;padding:0.1rem 0.3rem;border-bottom:1px solid var(--border);font-size:0.75rem;">
            <div style="flex:1;min-width:0;">
                <div style="display:flex;justify-content:space-between;">
                    <span style="font-weight:600;color:${r?"var(--red)":"var(--text)"};">${p(e.name)}</span>
                    <span style="font-size:0.6rem;color:var(--text3);">${e.current||0}/${e.segments||4}</span>
                </div>
                <div style="width:100%;height:4px;background:var(--bg4);border-radius:2px;overflow:hidden;">
                    <div style="width:${t}%;height:100%;background:${r?"var(--red)":t>80?"var(--orange)":"var(--gold)"};border-radius:2px;"></div>
                </div>
                ${e.description?`<div style="font-size:0.6rem;color:var(--text2);">${p(e.description)}</div>`:""}
                ${r?'<div style="font-size:0.6rem;color:var(--red);">⚠️ DUE!</div>':""}
            </div>
            <div style="display:flex;gap:0.2rem;">
                <button class="btn btn-xs btn-secondary" onclick="window.witchTickTimer('${e.id}')" style="font-size:0.6rem;">+</button>
                <button class="btn btn-xs btn-ghost" onclick="window.witchRemoveTimer('${e.id}')" style="color:var(--red);font-size:0.6rem;">✕</button>
            </div>
        </div>
    `}function Yn(e){return`
        <div class="witchcraft-timers" style="background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;border:1px solid var(--border);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.2rem;">
                <span style="font-size:0.85rem;font-weight:600;color:var(--gold);">⏳ Promise Timers</span>
                <div style="display:flex;gap:0.2rem;align-items:center;">
                    <span style="font-size:0.6rem;color:var(--text3);">${e.length} active</span>
                    <button class="btn btn-xs btn-secondary" onclick="window.witchAddTimer()">${ze?"✕ Cancel":"+ Add"}</button>
                </div>
            </div>
            ${ze?`
                <div class="craft-inline-form" style="background:var(--bg3);border-radius:var(--radius);padding:0.3rem 0.4rem;display:flex;flex-direction:column;gap:0.25rem;margin-bottom:0.3rem;border:1px solid var(--border);">
                    <input id="timer-name" type="text" placeholder="Promise name (e.g. Debt to the Web)" style="background:var(--bg2);border:1px solid var(--border);border-radius:4px;padding:0.2rem 0.35rem;font-size:0.75rem;" />
                    <label style="font-size:0.65rem;color:var(--text3);">Segments
                        <input id="timer-segments" type="number" min="1" value="4" style="width:100%;background:var(--bg2);border:1px solid var(--border);border-radius:4px;padding:0.2rem 0.35rem;font-size:0.75rem;margin-top:0.1rem;" />
                    </label>
                    <input id="timer-description" type="text" placeholder="What happens when it's full?" style="background:var(--bg2);border:1px solid var(--border);border-radius:4px;padding:0.2rem 0.35rem;font-size:0.75rem;" />
                    <div style="display:flex;gap:0.3rem;">
                        <button class="btn btn-xs btn-gold" onclick="window.witchSubmitTimer()">⏳ Create</button>
                        <button class="btn btn-xs btn-ghost" onclick="window.witchAddTimer()">Cancel</button>
                    </div>
                </div>
            `:""}
            <div style="display:flex;flex-direction:column;gap:0.15rem;max-height:150px;overflow-y:auto;">
                ${e.length===0?`
                    <div style="font-size:0.75rem;color:var(--text3);text-align:center;padding:0.5rem 0;">
                        No active promises. When you make a deal, track it here.
                    </div>
                `:e.map(t=>Un(t)).join("")}
            </div>
        </div>
    `}function Xn(e,t){return`
        <div class="witchcraft-prices" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:0.3rem;background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;${t?"border:2px solid var(--red);":"border:1px solid var(--border);"}">
            ${Object.entries(Hn).map(([r,n])=>{const o=e[r]||0,i=Math.min(100,o/n.max*100),a=o>=n.warningAt;return`
                    <div style="text-align:center;">
                        <div style="display:flex;justify-content:space-between;font-size:0.75rem;">
                            <span style="color:${n.color};">${n.icon} ${n.label}</span>
                            <span style="font-weight:600;color:${a?"var(--red)":"var(--text)"};">${o}/${n.max}</span>
                        </div>
                        <div style="width:100%;height:6px;background:var(--bg4);border-radius:3px;overflow:hidden;">
                            <div style="width:${i}%;height:100%;background:${a?"var(--red)":n.color};border-radius:3px;transition:width 0.3s;"></div>
                        </div>
                        ${a?'<div style="font-size:0.5rem;color:var(--red);">⚠️ Near threshold</div>':""}
                    </div>
                `}).join("")}
            <div style="display:flex;gap:0.2rem;align-items:center;justify-content:center;">
                ${$e?`
                    <span style="font-size:0.6rem;color:var(--red);">Clear all?</span>
                    <button class="btn btn-xs btn-danger" onclick="window.witchClearPrices()">Yes</button>
                    <button class="btn btn-xs btn-ghost" onclick="window.witchCancelClearPrices()">No</button>
                `:`
                    <button class="btn btn-xs btn-ghost" onclick="window.witchClearPrices()">✕ Clear</button>
                `}
            </div>
        </div>
    `}function Kn(){return`
        <div class="craft-inline-form" style="background:var(--bg2);border:1px solid var(--gold);border-radius:var(--radius);padding:0.4rem 0.5rem;display:flex;flex-direction:column;gap:0.3rem;">
            <div style="font-weight:600;font-size:0.8rem;color:var(--gold);">⚡ Quick Working</div>
            <label style="font-size:0.7rem;color:var(--text2);">Threshold
                <input id="qw-threshold" type="text" value="door" placeholder="door, tide line, wound, vow, breath..." style="width:100%;background:var(--bg3);border:1px solid var(--border);border-radius:4px;padding:0.2rem 0.35rem;font-size:0.75rem;margin-top:0.1rem;" />
            </label>
            <div style="display:flex;gap:0.3rem;flex-wrap:wrap;">
                <label style="font-size:0.7rem;color:var(--text2);flex:1;min-width:140px;">Layer
                    <select id="qw-layer" style="width:100%;background:var(--bg3);border:1px solid var(--border);border-radius:4px;padding:0.2rem 0.35rem;font-size:0.75rem;margin-top:0.1rem;">
                        <option value="Echo">Echo — past memory</option>
                        <option value="Veil" selected>Veil — present boundary</option>
                        <option value="Flow">Flow — future direction</option>
                    </select>
                </label>
                <label style="font-size:0.7rem;color:var(--text2);flex:1;min-width:120px;">Tag
                    <input id="qw-tag" type="text" value="BIND" placeholder="BIND, LIGHT, SILENCE..." style="width:100%;background:var(--bg3);border:1px solid var(--border);border-radius:4px;padding:0.2rem 0.35rem;font-size:0.75rem;margin-top:0.1rem;" />
                </label>
            </div>
            <label style="font-size:0.7rem;color:var(--text2);display:flex;align-items:center;gap:0.35rem;">
                <input type="checkbox" id="qw-desperate" /> Desperate position (threatened — DV 4 instead of 3)
            </label>
            <div style="display:flex;gap:0.3rem;">
                <button class="btn btn-sm btn-gold" onclick="window.witchSubmitQuickWork()">⚡ Work It</button>
                <button class="btn btn-sm btn-ghost" onclick="window.witchQuickWork()">Cancel</button>
            </div>
        </div>
    `}function Qn(){return`
        <div class="craft-inline-form" style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius);padding:0.35rem 0.45rem;display:flex;flex-direction:column;gap:0.25rem;margin-bottom:0.25rem;">
            <input id="ritual-threshold" type="text" placeholder="Threshold (door, crossroads, grave, hearth...)" value="Crossroads" style="background:var(--bg2);border:1px solid var(--border);border-radius:4px;padding:0.2rem 0.35rem;font-size:0.75rem;" />
            <input id="ritual-witness" type="text" placeholder="Witness (person, spirit, Hollowed...)" value="The Pale Shepherd" style="background:var(--bg2);border:1px solid var(--border);border-radius:4px;padding:0.2rem 0.35rem;font-size:0.75rem;" />
            <input id="ritual-will" type="text" placeholder="Will — what do you intend to change?" value="Heal the land" style="background:var(--bg2);border:1px solid var(--border);border-radius:4px;padding:0.2rem 0.35rem;font-size:0.75rem;" />
            <input id="ritual-price" type="text" placeholder="Price (memory, name, lock of hair, promise, blood...)" value="Memory of a childhood home" style="background:var(--bg2);border:1px solid var(--border);border-radius:4px;padding:0.2rem 0.35rem;font-size:0.75rem;" />
            <label style="font-size:0.7rem;color:var(--text2);">Difficulty
                <select id="ritual-dv" style="width:100%;background:var(--bg2);border:1px solid var(--border);border-radius:4px;padding:0.2rem 0.35rem;font-size:0.75rem;margin-top:0.1rem;">
                    <option value="3">DV 3</option>
                    <option value="4" selected>DV 4</option>
                    <option value="5">DV 5</option>
                    <option value="6">DV 6</option>
                </select>
            </label>
            <div style="display:flex;gap:0.3rem;">
                <button class="btn btn-sm btn-gold" onclick="window.witchSubmitRitual()">🕯️ Perform Ritual</button>
                <button class="btn btn-sm btn-ghost" onclick="window.witchFullRitual()">Cancel</button>
            </div>
        </div>
    `}function Jn(e){return`
        <div class="ritual-item" style="display:flex;justify-content:space-between;align-items:center;padding:0.1rem 0.3rem;border-bottom:1px solid var(--border);font-size:0.7rem;">
            <div style="flex:1;min-width:0;">
                <span style="font-weight:600;">${p(e.name)}</span>
                <span style="font-size:0.6rem;color:var(--text3);">${e.result||"Pending"}</span>
                ${e.effect?`<span style="font-size:0.6rem;color:var(--text2);">— ${p(e.effect)}</span>`:""}
            </div>
            <span style="font-size:0.5rem;color:var(--text3);">${e.date||""}</span>
        </div>
    `}function Zn(e){return`
        <div class="witchcraft-rituals" style="background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;border:1px solid var(--border);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.2rem;">
                <span style="font-size:0.85rem;font-weight:600;color:var(--gold);">🕯️ Full Rituals</span>
                <div style="display:flex;gap:0.3rem;align-items:center;">
                    <span style="font-size:0.6rem;color:var(--text3);">${e.length} performed</span>
                    <button class="btn btn-xs btn-secondary" onclick="window.witchFullRitual()">${Ce?"✕ Cancel":"+ New Ritual"}</button>
                </div>
            </div>
            ${Ce?Qn():""}
            <div style="display:flex;flex-direction:column;gap:0.15rem;max-height:120px;overflow-y:auto;">
                ${e.length===0?`
                    <div style="font-size:0.75rem;color:var(--text3);text-align:center;padding:0.5rem 0;">
                        No rituals performed. Perform a ritual to shape the world.
                    </div>
                `:e.slice(-5).reverse().map(t=>Jn(t)).join("")}
            </div>
        </div>
    `}window.witchAddGiftFromSelect=function(){const e=v();if(!e)return;if(!(e.talents||[]).some(a=>a.name==="Craft of the Hedge"||a.id==="craft-of-the-hedge")&&e.magicPath!=="witch"){l('Learn the "Craft of the Hedge" talent first.',"error");return}const t=document.getElementById("witch-gift-select");if(!t)return;const r=t.value,n=(e.patron?yr(e.patron):null)?.witchcraft?.hedge_gifts||[],o=[...vr,...n].find(a=>a.id===r);if(!o){l("Gift not found.","error");return}const i=Bt(e);if(i.some(a=>a.name===o.name)){l("Already learned this gift.","warning");return}i.push({...o,id:Y("gift_")}),k({witch:e.witch}),l(`🌿 Learned "${o.name}"`,"success"),W()};window.witchRemoveGift=function(e){const t=v();if(!t)return;let r=Bt(t);r=r.filter(n=>n.id!==e&&n.name!==e),t.witch.hedgeGifts=r,k({witch:t.witch}),l("Removed gift.","info"),W()};window.witchQuickWork=function(){Te=!Te,W()};window.witchSubmitQuickWork=function(){const e=v();if(!e)return;const t=(document.getElementById("qw-threshold")?.value||"").trim()||"door",r=document.getElementById("qw-layer")?.value||"Veil",n=(document.getElementById("qw-tag")?.value||"").trim()||"BIND",o=!!document.getElementById("qw-desperate")?.checked,i=(e.wits||1)+(e.skills?.lore||0),a=o?4:3,s=ae(i,a);let c,d,m=0,u=0;s.successes>=a&&s.storyBeats===0?(c="✨ Clean Success",d="none"):s.successes>=a&&s.storyBeats>0?(c="⚠️ Success with SB",d="shadow",m=s.storyBeats):s.successes>0&&s.successes<a?(c="⚠️ Partial Success",d="shame",m=s.storyBeats,u=1):(c="💀 Miss",d="identity",m=s.storyBeats||1,u=2);const f=e.magicPath==="witch";let h=!1;if(f&&d!=="none"){const b=at(e);d==="shadow"?(b.shadow+=1,h=!0):d==="shame"?(b.shame+=1,h=!0):d==="identity"&&(b.identityStrain+=1,h=!0),h&&(k({witch:e.witch}),b.identityStrain>=3&&l("🌀 Identity Strain threshold reached! Risk losing something of yourself.","error"))}u>0&&(e.boons=(e.boons||0)+u,e.boons>5&&(e.boons=5),k({boons:e.boons})),Te=!1;const y=c==="✨ Clean Success"?"var(--green)":c==="⚠️ Success with SB"?"var(--gold)":c==="⚠️ Partial Success"?"var(--orange)":"var(--red)";kr(`
        <div style="display:flex;flex-direction:column;gap:0.3rem;max-width:400px;">
            <div style="font-weight:600;font-size:1rem;color:var(--gold);">⚡ Quick Working</div>
            <div style="font-size:0.85rem;color:var(--text2);">
                <div><strong>Threshold:</strong> ${p(t)}</div>
                <div><strong>Layer:</strong> ${p(r)} · <strong>Tag:</strong> ${p(n)}</div>
            </div>
            <div style="font-size:0.75rem;color:var(--text3);">Pool: ${i}d · DV: ${a} · Position: ${o?"Desperate":"Controlled"}</div>
            <div style="font-size:0.7rem;color:var(--text3);">Roll: ${s.dice.join(", ")}</div>
            <div style="font-size:0.8rem;">Rolled: <strong>${s.successes}</strong> successes</div>
            <div style="font-size:1rem;font-weight:600;color:${y};">${c}</div>
            ${h?`<div style="color:var(--red);font-size:0.8rem;">Price: ${d} (+1)</div>`:'<div style="color:var(--green);">No price.</div>'}
            ${m>0?`<div style="color:var(--text3);font-size:0.75rem;">📖 GM gains ${m} SB</div>`:""}
            ${u>0?`<div style="color:var(--gold);font-size:0.75rem;">⭐ +${u} Boon${u>1?"s":""}</div>`:""}
        </div>
    `,c==="✨ Clean Success"?"success":"info"),W()};window.witchFullRitual=function(){const e=v();if(e){if(e.magicPath!=="witch"){l("Full rituals require the Witch magic path.","error");return}Ce=!Ce,W()}};window.witchSubmitRitual=function(){const e=v();if(!e)return;const t=(document.getElementById("ritual-threshold")?.value||"").trim()||"Crossroads",r=(document.getElementById("ritual-witness")?.value||"").trim()||"A silent witness",n=(document.getElementById("ritual-will")?.value||"").trim()||"An unspoken intent",o=(document.getElementById("ritual-price")?.value||"").trim()||"Something unnamed",i=pe(document.getElementById("ritual-dv")?.value,4),a=(e.spirit||1)+(e.skills?.lore||0),s=ae(a,i);let c,d=!1,m=0,u=0;s.successes>=i&&s.storyBeats===0?(c="✅ Success",d=!0):s.successes>=i&&s.storyBeats>0?(c="⚠️ Success with Echo",d=!0,u=s.storyBeats):s.successes>0&&s.successes<i?(c="⚠️ Partial Success",m=1):(c="❌ Failure",u=s.storyBeats||1,m=2);const f=at(e);f.identityStrain+=1,k({witch:e.witch}),f.identityStrain>=3&&l("🌀 Identity Strain threshold reached! Risk losing something of yourself.","error"),m>0&&(e.boons=(e.boons||0)+m,e.boons>5&&(e.boons=5),k({boons:e.boons})),xr(e).push({id:Y("ritual_"),name:n.slice(0,30)+(n.length>30?"...":""),effect:n,threshold:t,witness:r,price:o,dv:i,result:d?"Success":c,date:new Date().toLocaleDateString()}),k({witch:e.witch}),Ce=!1;const h=d?"var(--green)":c==="⚠️ Partial Success"?"var(--orange)":"var(--red)";kr(`
        <div style="display:flex;flex-direction:column;gap:0.3rem;max-width:400px;">
            <div style="font-weight:600;font-size:1rem;color:var(--gold);">🕯️ Full Ritual</div>
            <div style="font-size:0.85rem;color:var(--text2);">
                <div><strong>Threshold:</strong> ${p(t)}</div>
                <div><strong>Witness:</strong> ${p(r)}</div>
                <div><strong>Will:</strong> ${p(n)}</div>
                <div><strong>Price:</strong> ${p(o)}</div>
            </div>
            <div style="font-size:0.75rem;color:var(--text3);">Pool: ${a}d · DV: ${i}</div>
            <div style="font-size:0.7rem;color:var(--text3);">Roll: ${s.dice.join(", ")}</div>
            <div style="font-size:0.8rem;">Rolled: <strong>${s.successes}</strong> successes</div>
            <div style="font-size:1rem;font-weight:600;color:${h};">${c}</div>
            <div style="color:var(--red);font-size:0.8rem;">🌀 Identity Strain +1</div>
            ${u>0?`<div style="color:var(--text3);font-size:0.75rem;">📖 GM gains ${u} SB</div>`:""}
            ${m>0?`<div style="color:var(--gold);font-size:0.75rem;">⭐ +${m} Boon${m>1?"s":""}</div>`:""}
        </div>
    `,d?"success":"info"),W()};window.witchAddTimer=function(){ze=!ze,W()};window.witchSubmitTimer=function(){const e=v();if(!e)return;const t=(document.getElementById("timer-name")?.value||"").trim();if(!t){l("Give the promise a name.","error");return}const r=Math.max(1,pe(document.getElementById("timer-segments")?.value,4)),n=(document.getElementById("timer-description")?.value||"").trim();st(e).push({id:Y("timer_"),name:t,segments:r,current:0,description:n,createdAt:Date.now()}),k({witch:e.witch}),ze=!1,l(`⏳ Promise "${t}" created.`,"success"),W()};window.witchTickTimer=function(e){const t=v();if(!t)return;const r=st(t).find(n=>n.id===e);if(!r)return l("Timer not found.","error");r.current=(r.current||0)+1,r.current>=r.segments&&l(`⏳ "${r.name}" is full! The price comes due.`,"warning"),k({witch:t.witch}),W()};window.witchRemoveTimer=function(e){const t=v();if(!t)return;let r=st(t);r=r.filter(n=>n.id!==e),t.witch.promiseTimers=r,k({witch:t.witch}),l("Timer removed.","info"),W()};window.witchClearPrices=function(){if(!$e){$e=!0,W();return}const e=v();if(!e)return;const t=at(e);t.shadow=0,t.shame=0,t.identityStrain=0,k({witch:e.witch}),$e=!1,l("Prices cleared.","info"),W()};window.witchCancelClearPrices=function(){$e=!1,W()};window.witchChooseWeaver=function(){Pe=!Pe,W()};window.witchSelectWeaver=function(e){const t=v();if(!t)return;t.patron=e,k({patron:e}),Pe=!1;const r=wr().find(n=>n.patronId===e);l(`🧙 Chosen weaver: ${r?r.patronName:e}`,"success"),W()};window.witchRefresh=async function(){l("🔄 Reloading patron data…","info"),await br(!0),await W(),l("✅ Hedge magic refreshed.","success")};function kr(e,t="info"){const r=document.querySelector(".custom-toast-modal");r&&r.remove();const n=document.createElement("div");n.className="custom-toast-modal",n.style.cssText=`
        position: fixed; bottom: 1rem; right: 1rem; z-index: 9999;
        animation: toastFadeIn 0.2s ease;
    `;const o=document.createElement("div");if(o.style.cssText=`
        background: var(--bg1); padding: 1.2rem; border-radius: var(--radius);
        max-width: 420px; width: 90vw; border: 1px solid var(--border);
        box-shadow: 0 8px 32px rgba(0,0,0,0.5);
        max-height: 60vh; overflow-y: auto;
    `,o.innerHTML=e+`<br><button class="btn btn-xs btn-secondary" onclick="this.closest('.custom-toast-modal').remove()">Close</button>`,n.appendChild(o),document.body.appendChild(n),!document.getElementById("toast-animation-style")){const i=document.createElement("style");i.id="toast-animation-style",i.textContent=`
            @keyframes toastFadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        `,document.head.appendChild(i)}setTimeout(()=>{n.parentNode&&n.remove()},1e4)}var{loadPatronData:lt}=De;function Z(e){return e?p(e).replace(/\n/g,"<br>"):""}function eo(e,t){if(!t)return null;if(e.patrons?.cosmic){const r=e.patrons.cosmic.find(n=>n.id===t);if(r)return r}if(e.patrons?.terrestrial){const r=e.patrons.terrestrial.find(n=>n.id===t);if(r)return r}if(e.patrons?.religions){for(const r of e.patrons.religions)if(r.orders){const n=r.orders.find(o=>o.id===t);if(n)return{...n,_religion:r.name,_religionIcon:r.icon}}}return null}function Ve(e){typeof window.sendToVTT=="function"?window.sendToVTT(e,"System",{isHTML:!0}):console.warn("[Monks] VTT not available — message not sent.")}function Ue(e,t,r,n,o,i=""){return`
        <div style="
            background:var(--bg2);
            border-radius:var(--radius);
            padding:0.5rem 0.8rem;
            border:1px solid var(--border);
            border-left:4px solid var(--gold);
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            max-width: 450px;
            margin:0.1rem 0;
            font-family: inherit;
        ">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.2rem;">
                <div style="display:flex;align-items:center;gap:0.3rem;">
                    <span style="font-size:1.2rem;">${p(r||"🧘")}</span>
                    <span style="font-weight:700;font-size:1.05rem;color:var(--gold);">${p(e)}</span>
                </div>
                <span style="font-size:0.65rem;color:var(--text3);">${p(t||"Monk")}</span>
            </div>
            ${n?`<div style="font-size:0.8rem;color:var(--text);margin-top:0.2rem;line-height:1.4;">${Z(n)}</div>`:""}
            ${o?`<div style="font-size:0.7rem;color:var(--text3);margin-top:0.15rem;">${Z(o)}</div>`:""}
            ${i?`<div style="font-size:0.65rem;color:var(--text3);margin-top:0.1rem;">${Z(i)}</div>`:""}
        </div>
    `}var q={ENTERING:"entering",HOLDING:"holding",RELEASING:"releasing",EMPTY:"empty"},ye={[q.ENTERING]:"🌬️ Entering Breath – Drawing in the world",[q.HOLDING]:"🫁 Holding Breath – The pause between",[q.RELEASING]:"💨 Releasing Breath – Action made manifest",[q.EMPTY]:"🌌 Empty Breath – The still point, the void"},to={[q.ENTERING]:"+1 die to Perception and Insight",[q.HOLDING]:"+1 die to Defense and Resolve",[q.RELEASING]:"+1 die to Attack and Athletics",[q.EMPTY]:"+1 die to all rolls, but cannot use Flow"},Ye=["foundation","working","signature","quiet"],Lt=[{id:"open-hand",name:"The Open Hand",xp:2,category:"foundation",description:"Once per scene, when you attempt to parry, deflect, or disarm an opponent, treat your first Body or Melee roll as Position +1.",tags:["Strike","BOD","Flow","monk","unarmed","defense","reactive","once-per-scene","starter","minor"],effect:"Position +1 on first defensive roll per scene."},{id:"still-point",name:"Still Point Stance",xp:2,category:"foundation",description:"When you do not move during your turn, gain +1 die to your next defense roll. This benefit lasts until you move or take an aggressive action.",tags:["Move","SPT","Flow","monk","unarmed","defense","conditional","starter","minor"],effect:"+1 die to defense when standing still."},{id:"monks-breath",name:"Monk's Breath",xp:2,category:"foundation",description:"Once per session, you may clear 1 Fatigue by meditating for one minute uninterrupted. No roll required.",tags:["Heal","SPT","Restoration","monk","unarmed","fatigue","active","once-per-session","starter","minor"],effect:"Clear 1 Fatigue with 1 minute of meditation."}],Sr=[{id:"redirecting-current",name:"Redirecting Current",xp:3,category:"working",description:"When an enemy misses you with a melee attack, you may immediately reposition them one range band in a direction of your choice. Once per scene.",tags:["Move","Flow","Gambit","monk","unarmed","movement","reactive","once-per-scene","minor"],effect:"Reposition a missing attacker."},{id:"unarmoured-body",name:"The Unarmoured Body",xp:4,category:"working",description:"When unarmoured, convert the first point of Harm you would take each scene to Fatigue instead.",tags:["Armour","BOD","Flow","monk","unarmed","defense","passive","major"],effect:"First Harm per scene becomes Fatigue when unarmoured."},{id:"pressure-point",name:"Pressure Point Strike",xp:4,category:"working",description:"When you make an unarmed attack, declare a Pressure Point Strike. On a hit, the target suffers -1 die on all physical actions until the end of their next turn.",tags:["Strike","AGI","Gambit","monk","unarmed","combat","active","major"],effect:"-1 die to target's physical actions on hit."}],Tr=[{id:"unstruck-bell-talent",name:"The Unstruck Bell",xp:5,category:"signature",description:"Once per session, when you would be hit by an attack, declare that the attack misses you entirely. Describe how you were not there.",tags:["Defense","Flow","Overload","monk","unarmed","defense","reactive","once-per-session","major"],effect:"Negate one attack per session.",cost:"GM gains 1 Story Beat."},{id:"master-open-palm",name:"Master of the Open Palm",xp:5,category:"signature",description:"Once per session, convert a successful unarmed strike into a healing touch instead of dealing Harm. The target clears 1 Fatigue and may remove a minor Condition.",tags:["Strike","Combo","Restoration","monk","unarmed","healer","active","once-per-session","major"],effect:"Convert strike to healing touch."}],Cr={id:"stillness-that-moves",name:"The Stillness That Moves",xp:6,category:"quiet",description:"Once per arc, move through a space that should be impassable as if you were never there. You do not break, force, or open. You simply arrive on the other side.",tags:["Move","Flow","Overload","monk","unarmed","movement","active","once-per-arc","major","capstone"],effect:"Pass through impassable space once per arc.",cost:"Permanent Breath Scar: You can never again be surprised, but neither can you ever truly rest."},zr=[...Lt,...Sr,...Tr,Cr],Et={foundation:Lt,working:Sr,signature:Tr,quiet:[Cr]},Xe={foundation:"Foundation (2 XP)",working:"Working Knife (3-4 XP)",signature:"Signature Moves (5 XP)",quiet:"The Quiet Talent (6 XP)"},ro={foundation:"🌱",working:"🔪",signature:"⭐",quiet:"🌙"};function no(e){return zr.find(t=>t.id===e)||null}function fe(e){return!!(e.monkTalents&&e.monkTalents.length>0)}function It(e,t){const r=Ye.indexOf(t);if(r<=0)return null;const n=Ye[r-1],o=e.monkTalents||[];return Et[n].some(i=>o.includes(i.id))?null:n}var ee=null;function Ke(e){return e.breathState||q.ENTERING}function Pr(e){return e.monasticTradition||null}async function be(e){const t=Pr(e);if(!t)return null;const r=await jt(t);return r?{patronId:r.patron.id,patronName:r.patron.name||r.patron.title||r.patronId,patronIcon:r.patron.icon||"📿",tradition:r.tradition,religion:r.religion}:null}function oo(e){return e.breathScars||[]}function io(e,t){return(e.monkTalents||[]).includes(t)}function _(e,t,r){return(e.monkTechniques||{})[t]?.includes(r)||!1}function Ft(e){return e.flowPoints||3}function Fe(e){return Math.max(1,e.spirit||1)}function Rr(e,t){if(!t)return 0;const r=t.tradition.corruption||[];if(r.length===0)return 0;const n=(e.monkTalents||[]).length,o=t.patronId,i=n+(e.monkTechniques?.[o]||[]).length;return Math.max(0,Math.min(r.length,i))}async function jt(e){if(!e)return null;await lt();const t=eo(E(),e);return t&&t.monastic_tradition?{patron:t,tradition:t.monastic_tradition,religion:t._religion||null}:null}async function ao(){await lt();const e=E(),t=[];if(e.patrons?.cosmic)for(const r of e.patrons.cosmic)r.monastic_tradition&&t.push({patronId:r.id,patronName:r.name||r.title||r.id,patronIcon:r.icon||"📿",tradition:r.monastic_tradition,source:"cosmic"});if(e.patrons?.terrestrial)for(const r of e.patrons.terrestrial)r.monastic_tradition&&t.push({patronId:r.id,patronName:r.name||r.title||r.id,patronIcon:r.icon||"🏛️",tradition:r.monastic_tradition,source:"terrestrial"});if(e.patrons?.religions){for(const r of e.patrons.religions)if(r.orders)for(const n of r.orders)n.monastic_tradition&&t.push({patronId:n.id,patronName:n.name||n.id,patronIcon:n.icon||r.icon||"⛪",tradition:n.monastic_tradition,source:"religion",religion:r.name})}return t}function so(e,t=3){const r=[];let n=0;const o=(e.body||1)+(e.skills?.athletics||0),i=ae(o,2).successes>=2;r.push({step:"Settle the Body",pool:o,success:i,result:i?"✅ Body settled.":"❌ Distracted by an ache."}),i||(n+=1);const a=e.spirit||1,s=e.skills?.insight||0,c=a+s,d=ae(c,3).successes>=3;r.push({step:"Settle the Breath",pool:c,success:d,result:d?"✅ Breath settled.":"⚠️ Mind wanders. GM gains 1 SB."}),d||(n+=1);const m=e.presence||1,u=e.skills?.sway||0,f=a+m+Math.floor((s+u)/2),h=ae(f,t),y=h.successes>=t;let b=!1;h.successes>0&&h.successes<t&&(b=!0),r.push({step:"The Still Point",pool:f,success:y,partial:b,result:y?"✅ Reached the still point.":b?"⚠️ Reached but drained. Mark 1 Fatigue.":"❌ Lost in thought. GM gains 2 SB."}),!y&&!b&&(n+=2),b&&(n+=1);const $=y,g=b;let w=[];return $&&!g?(w.push("Clear 1 Fatigue"),(e.conditions||[]).some(T=>["Fear","Shaken","Guilty"].includes(T))&&w.push("May remove one minor Condition (Fear, Shaken, Guilty)"),w.push("Gain +1 die to next Wits-based roll (Clarity Meditation)"),w.push("Advance your Breath State one step")):$&&g?(w.push("Clear 1 Fatigue (but mark 1 Fatigue from exhaustion)"),w.push("Net: no Fatigue change")):w.push("No benefit. Try again after rest."),{results:r,achieved:$,drained:g,benefits:w,sbCount:n}}async function se(e){ee=e;const t=v();if(!t){e.innerHTML=`
            <div class="panel" style="padding:1rem;text-align:center;color:var(--text3);">
                <div style="font-size:2rem;">🧘</div>
                <p>Select a character to view their monastic path.</p>
            </div>
        `;return}if(!fe(t)){lo(e,t);return}await lt();const r=Pr(t),n=r?await be(t):null,o=Ke(t),i=oo(t),a=Ft(t),s=Fe(t),c=Rr(t,n);n&&c!==(t.monkCorruptionTier||0)&&(t.monkCorruptionTier=c,k({monkCorruptionTier:c}));const d=n?.tradition?.gm_guidance||[],m=d.length>0?d[Math.floor(Math.random()*d.length)]:null,u=await ao(),f=u.map(S=>`<option value="${S.patronId}" ${S.patronId===r?"selected":""}>${S.patronIcon} ${S.patronName} – ${S.tradition.name}</option>`).join(""),h=`
        <option value="3">Clarity (DV 3)</option>
        <option value="4">Healing (DV 4)</option>
        <option value="5">Transcendence (DV 5)</option>
    `,y=t.monkTalents||[],b=zr.filter(S=>y.includes(S.id)?!1:It(t,S.category)===null),$=b.map(S=>`<option value="${S.id}">${S.name} (${S.xp} XP) — ${S.effect||S.description.substring(0,40)}...</option>`).join("");let g="";if(n){const S=n.tradition,x=["basic","advanced","master"],z={basic:"Basic",advanced:"Advanced",master:"Master"},H={basic:S.techniques?.basic?.xp||6,advanced:S.techniques?.advanced?.xp||8,master:S.techniques?.master?.xp||12};g=x.filter(B=>!(_(t,n.patronId,B)||B==="advanced"&&!_(t,n.patronId,"basic")||B==="master"&&!_(t,n.patronId,"advanced"))).map(B=>`<option value="${B}">${z[B]} — ${S.techniques[B]?.name||B} (${H[B]} XP)</option>`).join(""),g||(g='<option value="">All techniques learned!</option>')}e.innerHTML=`
        <div class="monks-container" style="display:flex;flex-direction:column;gap:0.6rem;">

            <!-- ─── Header ─────────────────────────────────────── -->
            <div class="monks-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.3rem;border-bottom:2px solid var(--border);padding-bottom:0.3rem;">
                <div style="display:flex;align-items:center;gap:0.4rem;">
                    <span style="font-size:1.4rem;">🧘</span>
                    <div>
                        <span style="font-weight:600;font-size:1.05rem;color:var(--gold);">Monastic Path</span>
                        <span style="font-size:0.7rem;color:var(--text3);margin-left:0.3rem;">${n?n.patronName:"No Tradition"}</span>
                    </div>
                </div>
                <div style="display:flex;gap:0.3rem;flex-wrap:wrap;align-items:center;">
                    <select id="monk-meditation-dv-select" style="font-size:0.65rem;background:var(--bg3);border:1px solid var(--border);border-radius:4px;padding:0.1rem 0.3rem;">
                        ${h}
                    </select>
                    <button class="btn btn-sm btn-gold" onclick="window.monkMeditateFromSelect()">🧘 Meditate</button>
                    <button class="btn btn-sm btn-primary" onclick="window.monkChooseTradition()">📿 Tradition</button>
                    <button class="btn btn-sm btn-secondary" onclick="window.monkRefresh()" title="Reloads patron data from disk, bypassing any cached copy">🔄 Refresh</button>
                </div>
            </div>

            <!-- ─── Breath State + Flow ────────────────────────── -->
            <div style="display:grid;grid-template-columns:2fr 1fr;gap:0.3rem;">
                <div class="monks-breath" style="background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;border-left:4px solid var(--gold);">
                    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.2rem;">
                        <div>
                            <div style="font-size:0.8rem;font-weight:600;">${ye[o]||"Unknown Breath"}</div>
                            <div style="font-size:0.65rem;color:var(--text3);">${to[o]||""}</div>
                        </div>
                        <div style="display:flex;gap:0.2rem;align-items:center;">
                            <span style="font-size:0.6rem;color:var(--text3);">${i.length>0?`⚠️ Scars: ${i.join(", ")}`:"No scars"}</span>
                            <button class="btn btn-xs btn-ghost" onclick="window.monkAdvanceBreath()" title="Advance to next breath state">→</button>
                        </div>
                    </div>
                    <div style="display:flex;gap:0.2rem;margin-top:0.1rem;font-size:0.6rem;color:var(--text3);">
                        ${Object.entries(q).map(([S,x])=>`
                            <span style="${x===o?"font-weight:600;color:var(--gold);":""}">${x===o?"●":"○"} ${S.charAt(0).toUpperCase()+S.slice(1)}</span>
                        `).join(" ")}
                    </div>
                </div>

                <div class="monks-flow" style="background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;border-left:4px solid var(--blue);text-align:center;">
                    <div style="font-size:0.7rem;color:var(--text3);">🌀 Flow Points</div>
                    <div style="font-size:1.2rem;font-weight:600;color:var(--blue);">${a} / ${s}</div>
                    <div style="display:flex;gap:0.2rem;justify-content:center;margin-top:0.1rem;flex-wrap:wrap;">
                        <button class="btn btn-xs btn-secondary" onclick="window.monkAddFlow(1)">+</button>
                        <button class="btn btn-xs btn-secondary" onclick="window.monkAddFlow(-1)">−</button>
                        <button class="btn btn-xs btn-gold" onclick="window.monkUseFlow()">🌀 Use Flow</button>
                        <span style="font-size:0.55rem;color:var(--text3);">(Spend 1 to avoid Fatigue)</span>
                    </div>
                </div>
            </div>

            <!-- ─── Tradition Display ───────────────────────────── -->
            ${n?co(n,t):po(u)}

            <!-- ─── Tradition Selector (dropdown) ──────────────── -->
            <div style="display:flex;gap:0.3rem;align-items:center;background:var(--bg2);border-radius:var(--radius);padding:0.2rem 0.5rem;border:1px solid var(--border);flex-wrap:wrap;">
                <span style="font-size:0.7rem;color:var(--text3);">📿 Set Tradition:</span>
                <select id="monk-tradition-select" style="flex:1;min-width:150px;background:var(--bg3);border:1px solid var(--border);border-radius:4px;padding:0.1rem 0.3rem;font-size:0.7rem;">
                    <option value="">— Choose a tradition —</option>
                    ${f}
                </select>
                <button class="btn btn-xs btn-primary" onclick="window.monkSetTraditionFromSelect()">Set</button>
                ${n?'<button class="btn btn-xs btn-ghost" onclick="window.monkClearTradition()" style="color:var(--red);">✕ Clear</button>':""}
            </div>

            <!-- ─── GM Intrusion ────────────────────────────────── -->
            ${m?`
                <div class="monks-intrusion" style="background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;border-left:4px solid var(--orange);font-size:0.75rem;color:var(--text2);">
                    <span style="font-weight:600;color:var(--orange);">⚠️ GM Intrusion:</span> "${Z(m)}"
                </div>
            `:""}

            <!-- ─── Meditation Results ──────────────────────────── -->
            <div id="monk-meditation-results" style="display:none;"></div>

            <!-- ─── Corruption ──────────────────────────────────── -->
            ${n&&c>0?fo(n,c):""}

            <!-- ─── Talents & Techniques ───────────────────────── -->
            <div class="monks-talents" style="background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.2rem;flex-wrap:wrap;gap:0.2rem;">
                    <span style="font-size:0.85rem;font-weight:600;color:var(--gold);">⚡ Talents & Techniques</span>
                    <div style="display:flex;gap:0.2rem;flex-wrap:wrap;align-items:center;">
                        ${b.length>0?`
                            <select id="monk-talent-select" style="font-size:0.6rem;background:var(--bg3);border:1px solid var(--border);border-radius:4px;padding:0.05rem 0.2rem;max-width:200px;">
                                ${$}
                            </select>
                            <button class="btn btn-xs btn-primary" onclick="window.monkLearnTalentFromSelect()">Learn</button>
                        `:`
                            <span style="font-size:0.6rem;color:var(--text3);">All talents learned!</span>
                        `}
                        ${n&&g?`
                            <select id="monk-technique-select" style="font-size:0.6rem;background:var(--bg3);border:1px solid var(--border);border-radius:4px;padding:0.05rem 0.2rem;max-width:180px;">
                                ${g}
                            </select>
                            <button class="btn btn-xs btn-gold" onclick="window.monkLearnTechniqueFromSelect('${n.patronId}')">Learn Tech</button>
                        `:""}
                    </div>
                </div>
                <div style="display:flex;flex-direction:column;gap:0.15rem;max-height:250px;overflow-y:auto;">
                    ${mo(t)}
                    ${n?uo(n,t):""}
                </div>
                <div style="font-size:0.55rem;color:var(--text3);margin-top:0.1rem;text-align:center;">
                    ${go(t)}
                </div>
            </div>

            <!-- ─── Quick Reference ────────────────────────────── -->
            <div class="monks-quickref" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:0.1rem;font-size:0.6rem;color:var(--text3);background:var(--bg2);border-radius:var(--radius);padding:0.15rem 0.3rem;border:1px solid var(--border);">
                <div>🧘 <strong>Meditate:</strong> Clear Fatigue, gain focus</div>
                <div>🌀 <strong>Flow:</strong> Spend Flow instead of Fatigue</div>
                <div>🫁 <strong>Breath:</strong> Cycle for bonuses</div>
                <div>📿 <strong>Tradition:</strong> Techniques + Corruption</div>
                <div>🌱 <strong>Foundation → Quiet:</strong> 3 → 4 → 5 → 6 XP</div>
            </div>

        </div>
    `;const w=document.getElementById("monk-meditation-results"),T=sessionStorage.getItem("fates-edge-meditation-result");T&&w&&(w.style.display="block",w.innerHTML=T,sessionStorage.removeItem("fates-edge-meditation-result"))}function lo(e,t){const r=t.totalXp||0,n=t.xpSpent||0;e.innerHTML=`
        <div class="monks-container" style="display:flex;flex-direction:column;gap:0.6rem;">
            <div class="monks-header" style="display:flex;align-items:center;gap:0.4rem;border-bottom:2px solid var(--border);padding-bottom:0.3rem;">
                <span style="font-size:1.4rem;">🧘</span>
                <span style="font-weight:600;font-size:1.05rem;color:var(--gold);">Monastic Path</span>
                <span style="font-size:0.7rem;color:var(--text3);">Begin the Way</span>
            </div>

            <div class="monks-not-started" style="background:var(--bg2);border-radius:var(--radius);padding:0.8rem;text-align:center;color:var(--text3);border:1px dashed var(--border);">
                <div style="font-size:2rem;">🥋</div>
                <p style="color:var(--text2);font-size:1.05rem;font-weight:500;">You have not yet begun the Way.</p>
                <p style="font-size:0.85rem;max-width:500px;margin:0.2rem auto;">
                    The monastic path is open to anyone — no patron required. 
                    Learn a <strong>Foundation talent</strong> to begin your journey.
                </p>
                <p style="font-size:0.75rem;color:var(--text3);">
                    Available XP: <strong style="color:var(--gold);">${r-n}</strong> 
                    (${n} spent of ${r})
                </p>
                <div style="display:flex;gap:0.3rem;justify-content:center;flex-wrap:wrap;margin-top:0.3rem;">
                    ${Lt.map(o=>`
                        <button class="btn btn-sm btn-primary" onclick="window.monkBuyTalent('${o.id}')">
                            ${o.name} (${o.xp} XP)
                        </button>
                    `).join("")}
                </div>
                <div style="font-size:0.7rem;color:var(--text3);margin-top:0.3rem;">
                    <strong>What you gain:</strong> Breath States, Meditation, and access to Techniques.
                </div>
            </div>

            <div style="font-size:0.7rem;color:var(--text3);background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;border-left:4px solid var(--gold);">
                <strong>💡 Tip:</strong> Foundation talents are cheap (2 XP) and unlock the entire monastic system.
                Choose the one that fits your character's style.
            </div>
        </div>
    `}function co(e,t){const r=e.tradition,n=e.patronId,o=_(t,n,"basic"),i=_(t,n,"advanced"),a=_(t,n,"master"),s=r.color||"var(--gold)";return`
        <div class="monks-tradition" style="background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;border-left:4px solid ${s};">
            <div style="display:flex;align-items:center;gap:0.3rem;flex-wrap:wrap;">
                <span style="font-size:1.2rem;">${e.patronIcon}</span>
                <span style="font-weight:600;font-size:0.95rem;color:${s};">${p(r.name)}</span>
                <span style="font-size:0.7rem;color:var(--text3);">Patron: ${p(e.patronName)}</span>
                ${e.religion?`<span style="font-size:0.6rem;color:var(--text3);">⛪ ${p(e.religion)}</span>`:""}
            </div>
            <div style="font-size:0.8rem;color:var(--text2);margin:0.15rem 0;">${Z(r.description)}</div>
            ${r.debt_resistant_frame?`<div style="font-size:0.7rem;color:var(--text3);margin-bottom:0.1rem;"><strong>🕸️ Debt Resistance:</strong> ${Z(r.debt_resistant_frame)}</div>`:""}
            <div style="display:flex;gap:0.3rem;font-size:0.65rem;color:var(--text3);">
                <span style="color:${o?"var(--green)":"var(--text3)"};">${o?"✅":"⬜"} Basic</span>
                <span style="color:${i?"var(--green)":"var(--text3)"};">${i?"✅":"⬜"} Advanced</span>
                <span style="color:${a?"var(--gold)":"var(--text3)"};">${a?"⭐":"⬜"} Master</span>
            </div>
            ${r.quote?`<blockquote style="margin:0.15rem 0;padding:0.15rem 0.5rem;font-size:0.7rem;color:var(--text3);border-left:2px solid ${s};">"${p(r.quote)}"</blockquote>`:""}
        </div>
    `}function po(e){return`
        <div class="monks-no-tradition" style="background:var(--bg2);border-radius:var(--radius);padding:0.5rem;text-align:center;color:var(--text3);border:1px dashed var(--border);">
            <div style="font-size:1.5rem;">📿</div>
            <p>No monastic tradition chosen.</p>
            <p style="font-size:0.8rem;">Choose a tradition from the dropdown above.</p>
        </div>
    `}function mo(e){const t=e.monkTalents||[];let r="";for(const n of Ye){const o=Et[n],i=o.some(s=>t.includes(s.id)),a=It(e,n);r+=`
            <div style="display:flex;flex-direction:column;gap:0.1rem;${i?"":"opacity:0.6;"}">
                <div style="font-size:0.65rem;font-weight:600;color:${i?"var(--gold)":"var(--text3)"};">
                    ${ro[n]} ${Xe[n]}
                    ${a?`(requires ${Xe[a]})`:""}
                </div>
                ${o.map(s=>{const c=t.includes(s.id);return`
                        <div class="talent-item" style="display:flex;justify-content:space-between;align-items:center;padding:0.1rem 0.3rem;border-bottom:1px solid var(--border);font-size:0.75rem;${c?"border-left:3px solid var(--gold);background:var(--bg3);":""}">
                            <div style="display:flex;align-items:center;gap:0.3rem;flex-wrap:wrap;">
                                <span>${c?"✅":"⬜"}</span>
                                <span style="${c?"font-weight:600;":""}">${p(s.name)}</span>
                                <span style="font-size:0.6rem;color:var(--text3);">${s.xp} XP</span>
                                ${s.effect?`<span style="font-size:0.6rem;color:var(--text2);">${p(s.effect)}</span>`:""}
                            </div>
                            ${c?"":`<button class="btn btn-xs ${a?"btn-secondary":"btn-primary"}" onclick="window.monkBuyTalent('${s.id}')" ${a?"disabled":""}>Learn</button>`}
                        </div>
                    `}).join("")}
            </div>
        `}return r}function uo(e,t){const r=e.tradition,n=e.patronId,o=["basic","advanced","master"],i={basic:"Basic",advanced:"Advanced",master:"Master"},a={basic:r.techniques?.basic?.xp||6,advanced:r.techniques?.advanced?.xp||8,master:r.techniques?.master?.xp||12},s=r.color||"var(--gold)";return o.map(c=>{const d=r.techniques?.[c];if(!d)return"";const m=_(t,n,c),u=!m&&(c==="basic"||c==="advanced"&&_(t,n,"basic")||c==="master"&&_(t,n,"advanced")),f=d.effect||d.description||"",h=d.cost||"";return`
            <div class="technique-item" style="display:flex;justify-content:space-between;align-items:center;padding:0.1rem 0.3rem;border-bottom:1px solid var(--border);font-size:0.75rem;${m?`border-left:3px solid ${s};background:var(--bg3);`:""}">
                <div style="display:flex;align-items:center;gap:0.3rem;flex-wrap:wrap;flex:1;min-width:0;">
                    <span>${m?"✅":"⬜"}</span>
                    <span style="${m?"font-weight:600;":""}">${p(d.name)}</span>
                    <span style="font-size:0.6rem;color:var(--text3);">${a[c]||d.xp||"?"} XP</span>
                    <span style="font-size:0.55rem;color:${s};">${i[c]}</span>
                    ${f?`<div style="width:100%;font-size:0.6rem;color:var(--text2);">${Z(f)}</div>`:""}
                    ${h?`<div style="font-size:0.6rem;color:var(--text3);">Cost: ${Z(h)}</div>`:""}
                </div>
                <div style="display:flex;gap:0.2rem;flex-shrink:0;margin-left:0.3rem;">
                    ${m?`<button class="btn btn-xs btn-gold" onclick="window.monkUseTechnique('${n}','${c}')">Use</button>`:""}
                    ${!m&&u?`<button class="btn btn-xs btn-gold" onclick="window.monkBuyTechnique('${n}','${c}')">Learn</button>`:""}
                    ${!m&&!u?`<span style="font-size:0.55rem;color:var(--text3);">${c==="advanced"?"Requires Basic":"Requires Advanced"}</span>`:""}
                </div>
            </div>
        `}).join("")}function fo(e,t){const r=e.tradition.corruption||[],n=r.find(o=>String(o.tier)===String(t))||r[t-1];return n?`
        <div class="monks-corruption" style="background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;border-left:4px solid var(--red);">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.2rem;">
                <span style="font-size:0.8rem;font-weight:600;color:var(--red);">⚠️ Mark of the Path — Tier ${t} / ${r.length}</span>
                <span style="font-size:0.65rem;color:var(--text3);">"The path leaves its mark."</span>
            </div>
            <div style="font-size:0.8rem;color:var(--gold);">${Z(n.benefit)}</div>
            <div style="font-size:0.75rem;color:var(--red);">${Z(n.cost)}</div>
            ${n.narrative?`<div style="font-size:0.65rem;color:var(--text3);font-style:italic;margin-top:0.1rem;">"${Z(n.narrative)}"</div>`:""}
        </div>
    `:""}function go(e){const t=e.monkTalents||[],r=t.length,n=e.monkTechniques||{},o=Object.values(n).reduce((a,s)=>a+s.length,0),i=Ye.find(a=>Et[a].some(s=>!t.includes(s.id)));return`${r} talents · ${o} techniques · Next: ${i?Xe[i]:"All talents learned!"}`}window.monkSetTraditionFromSelect=function(){const e=v();if(!e)return;if(!fe(e)){l("Learn a Foundation talent before choosing a tradition.","error");return}const t=document.getElementById("monk-tradition-select");if(!t)return;const r=t.value;if(!r){l("Please select a tradition.","error");return}e.monasticTradition=r,e.monkTechniques||(e.monkTechniques={}),k({monasticTradition:r,monkTechniques:e.monkTechniques}),l("📿 Chosen tradition.","success"),se(ee)};window.monkClearTradition=function(){const e=v();e&&confirm("Clear your monastic tradition? This will remove all techniques.")&&(e.monasticTradition=null,e.monkTechniques={},k({monasticTradition:null,monkTechniques:{}}),l("Tradition cleared.","info"),se(ee))};window.monkChooseTradition=function(){const e=document.getElementById("monk-tradition-select");e?(e.focus(),l("Select a tradition from the dropdown above.","info")):l("Please refresh the panel to use the dropdown.","info")};window.monkMeditateFromSelect=async function(){const e=v();if(!e)return;if(!fe(e)){l("Learn a Foundation talent before meditating.","error");return}const t=document.getElementById("monk-meditation-dv-select");if(!t)return;const r=parseInt(t.value);if(isNaN(r)||r<3||r>5){l("Invalid DV. Choose 3, 4, or 5.","error");return}const n=so(e,r);let o=`
        <div style="background:var(--bg2);border-radius:var(--radius);padding:0.5rem;border-left:4px solid ${n.achieved?"var(--green)":"var(--red)"};">
            <div style="display:flex;justify-content:space-between;align-items:center;">
                <span style="font-weight:600;">🧘 Meditation Results</span>
                <span style="font-size:0.7rem;color:var(--text3);">DV ${r}</span>
            </div>
            <div style="font-size:0.75rem;margin:0.15rem 0;">
                ${n.results.map(i=>`<div>${i.result}</div>`).join("")}
            </div>
            <div style="font-size:0.85rem;margin:0.15rem 0;${n.achieved?"color:var(--green);":"color:var(--red);"}">
                ${n.achieved?"✅ Meditation successful!":n.drained?"⚠️ Partial success – drained.":"❌ Meditation failed."}
            </div>
            ${n.benefits.length>0?`
                <div style="font-size:0.75rem;color:var(--gold);">
                    <strong>Benefits:</strong> ${n.benefits.join("; ")}
                </div>
            `:""}
            ${n.sbCount>0?`
                <div style="font-size:0.65rem;color:var(--text3);">GM gains ${n.sbCount} Story Beat${n.sbCount>1?"s":""}.</div>
            `:""}
            <button class="btn btn-xs btn-secondary" onclick="this.closest('#monk-meditation-results').style.display='none'">Close</button>
        </div>
    `;if(sessionStorage.setItem("fates-edge-meditation-result",o),n.achieved&&!n.drained){const i=e.fatigue||0;if(i>0&&(e.fatigue=i-1),r===4&&e.conditions){const d=["Fear","Shaken","Guilty"];d.some(m=>e.conditions.includes(m))&&confirm("Remove a minor condition (Fear, Shaken, Guilty)?")&&(e.conditions=e.conditions.filter(m=>!d.includes(m)))}r===3&&(e._clarityBonus=!0),r===5&&(e._transcendenceAvailable=!0);const a=Object.values(q),s=Ke(e),c=a[(a.indexOf(s)+1)%a.length];e.breathState=c,k({fatigue:e.fatigue,conditions:e.conditions,_clarityBonus:e._clarityBonus,_transcendenceAvailable:e._transcendenceAvailable,breathState:e.breathState}),Ve(Ue("Meditation Success",e.monasticTradition&&(await be(e))?.patronName||"Monk",e.monasticTradition&&(await be(e))?.patronIcon||"🧘",n.benefits.join("; "),`Breath advanced to ${ye[c]}`,`DV ${r} — The still point reached.`)),l(`🧘 Meditation successful! Breath advanced to ${ye[c]}`,"success")}else if(n.achieved&&n.drained){const i=Object.values(q),a=Ke(e),s=i[(i.indexOf(a)+1)%i.length];e.breathState=s,k({breathState:e.breathState}),Ve(Ue("Meditation (Drained)",e.monasticTradition&&(await be(e))?.patronName||"Monk",e.monasticTradition&&(await be(e))?.patronIcon||"🧘","Partial success – drained, but breath advances.",`Breath advanced to ${ye[s]}`,"Mark 1 Fatigue (net no change)")),l(`⚠️ Meditation drained, but breath advanced to ${ye[s]}`,"warning")}else l("❌ Meditation failed. Try again after rest.","error");se(ee)};window.monkMeditate=function(){document.getElementById("monk-meditation-dv-select")?window.monkMeditateFromSelect():l("Please refresh the panel to use the dropdown.","info")};window.monkAdvanceBreath=function(){const e=v();if(!e)return;if(!fe(e)){l("Learn a Foundation talent first.","error");return}const t=Object.values(q),r=Ke(e),n=t[(t.indexOf(r)+1)%t.length];e.breathState=n,k({breathState:n}),l(`🫁 Advanced to: ${ye[n]}`,"success"),se(ee)};window.monkAddFlow=function(e){const t=v();if(!t)return;if(!fe(t)){l("Learn a Foundation talent first.","error");return}const r=Ft(t),n=Fe(t),o=Math.max(0,Math.min(r+e,n));t.flowPoints=o,k({flowPoints:o}),se(ee),l(`🌀 Flow: ${o}/${n}`,"info")};window.monkUseFlow=async function(){const e=v();if(!e)return;if(!fe(e)){l("Learn a Foundation talent first.","error");return}const t=Ft(e);if(t<1){l("No Flow points available.","error");return}e.flowPoints=t-1,k({flowPoints:e.flowPoints}),Ve(Ue("🌀 Flow Spent",e.monasticTradition&&(await be(e))?.patronName||"Monk",e.monasticTradition&&(await be(e))?.patronIcon||"🧘","You channel your inner stillness to avoid exhaustion.",`Flow: ${e.flowPoints}/${Fe(e)} remaining`,"Use this to avoid marking Fatigue on a roll.")),l(`🌀 Spent 1 Flow. ${e.flowPoints}/${Fe(e)} remaining.`,"success"),se(ee)};window.monkLearnTalentFromSelect=function(){if(!v())return;const e=document.getElementById("monk-talent-select");if(!e)return;const t=e.value;if(!t){l("No learnable talents available.","info");return}window.monkBuyTalent(t)};window.monkLearnTechniqueFromSelect=function(e){if(!v())return;const t=document.getElementById("monk-technique-select");if(!t)return;const r=t.value;if(!r){l("No learnable techniques available.","info");return}window.monkBuyTechnique(e,r)};window.monkBuyTalent=function(e){const t=v();if(!t)return;const r=no(e);if(!r)return l("Talent not found.","error");if(io(t,e)){l("Already learned this talent.","warning");return}const n=It(t,r.category);if(n){l(`Learn a ${Xe[n]} talent first.`,"error");return}const o=(t.totalXp||0)-(t.xpSpent||0);if(o<r.xp){l(`Not enough XP. Need ${r.xp}, have ${o} available.`,"error");return}if(!confirm(`Learn "${r.name}" for ${r.xp} XP?`))return;const i=fe(t);t.monkTalents||(t.monkTalents=[]),t.monkTalents.push(e),t.xpSpent=(t.xpSpent||0)+r.xp,i||(t.flowPoints=Fe(t)),k({monkTalents:t.monkTalents,xpSpent:t.xpSpent,flowPoints:t.flowPoints}),i?l(`✅ Learned "${r.name}"`,"success"):l(`🥋 You have begun the Way. Learned "${r.name}"`,"success"),se(ee)};window.monkLearnTalent=function(e){const t=document.getElementById("monk-talent-select");t?(t.focus(),l("Select a talent from the dropdown above.","info")):l("Please refresh the panel to use the dropdown.","info")};window.monkBuyTechnique=async function(e,t){const r=v();if(!r)return;if(!fe(r)){l("Learn a Foundation talent before pursuing techniques.","error");return}const n=await jt(e);if(!n)return l("Tradition not found.","error");const o=n.tradition.techniques?.[t];if(!o)return l("Technique not found.","error");if(_(r,e,t)){l("Already learned this technique.","warning");return}if(t==="advanced"&&!_(r,e,"basic")){l("Must learn Basic technique first.","error");return}if(t==="master"&&!_(r,e,"advanced")){l("Must learn Advanced technique first.","error");return}const i=o.xp||(t==="basic"?6:t==="advanced"?8:12),a=(r.totalXp||0)-(r.xpSpent||0);if(a<i){l(`Not enough XP. Need ${i}, have ${a} available.`,"error");return}confirm(`Learn "${o.name}" for ${i} XP?`)&&(r.monkTechniques||(r.monkTechniques={}),r.monkTechniques[e]||(r.monkTechniques[e]=[]),r.monkTechniques[e].push(t),r.xpSpent=(r.xpSpent||0)+i,r.monkCorruptionTier=Rr(r,await be(r)),k({monkTechniques:r.monkTechniques,xpSpent:r.xpSpent,monkCorruptionTier:r.monkCorruptionTier}),l(`✅ Learned "${o.name}"`,"success"),se(ee))};window.monkUseTechnique=async function(e,t){const r=v();if(!r)return;if(!fe(r)){l("Learn a Foundation talent first.","error");return}const n=await jt(e);if(!n)return l("Tradition not found.","error");const o=n.tradition.techniques?.[t];if(!o)return l("Technique not found.","error");if(!_(r,e,t)){l("You haven't learned this technique.","error");return}const i=o.effect||o.description||"The technique is performed.",a=o.cost||"",s=o.name||`${t} technique`,c=n.patron.name||n.patron.title,d=n.patron.icon||"🧘";Ve(Ue(`${{basic:"Basic",advanced:"Advanced",master:"Master"}[t]||t} Technique: ${s}`,c,d,i,a,`Tradition: ${n.tradition.name}`)),l(`🧘 Used "${s}" — VTT card sent.`,"success")};window.monkLearnTechnique=function(e){const t=document.getElementById("monk-technique-select");t?(t.focus(),l("Select a technique from the dropdown above.","info")):l("Please refresh the panel to use the dropdown.","info")};window.monkRefresh=async function(){l("🔄 Reloading patron data from disk…","info"),await lt(!0),ee&&await se(ee),l("✅ Monks refreshed.","success")};var{loadPatronData:bt,getPatronObligation:Xo,savePatronData:Ko}=De;function O(e){if(e==null)return"";if(typeof e=="string")return e;if(typeof e=="number"||typeof e=="boolean")return String(e);if(Array.isArray(e))return e.map(t=>O(t)).join(", ");if(typeof e=="object"){if(e.name)return O(e.name);if(e.label)return O(e.label);if(e.description)return O(e.description);if(e.effect)return O(e.effect);if(e.text)return O(e.text);if(e.quote)return O(e.quote);if(e.lore)return O(e.lore);try{return JSON.stringify(e)}catch{return"[object]"}}return String(e)}function de(e){return e?p(e).replace(/\n/g,"<br>"):""}function ho(e){return{Cantrip:"var(--text3)",Basic:"#6baa7a",Low:"#6baa7a",Standard:"#d4af37",Advanced:"#c47a7a",Master:"#b84a8a",Epic:"#d94a4a",High:"#8e44ad"}[e]||"var(--text2)"}function bo(e){return{Low:"🌿",Standard:"⚜️",High:"👑"}[e]||"📜"}function vo(e,t){const r={Cantrip:0,Basic:1,Low:1,Standard:2,Advanced:3,Master:4,Epic:5,High:6},n=r[e.tier]??99,o=r[t.tier]??99;return n!==o?n-o:(e.name||"").localeCompare(t.name||"")}function vt(e,t){if(!t)return null;if(e.patrons?.cosmic){const r=e.patrons.cosmic.find(n=>n.id===t);if(r)return r}if(e.patrons?.terrestrial){const r=e.patrons.terrestrial.find(n=>n.id===t);if(r)return r}if(e.patrons?.religions){for(const r of e.patrons.religions)if(r.orders){const n=r.orders.find(o=>o.id===t);if(n)return{...n,_religion:r.name,_religionIcon:r.icon}}}return null}function Ar(e){const t=[];if(e.patrons?.cosmic&&t.push(...e.patrons.cosmic),e.patrons?.terrestrial&&t.push(...e.patrons.terrestrial),e.patrons?.religions){for(const r of e.patrons.religions)if(r.orders)for(const n of r.orders)t.push({...n,_religion:r.name,_religionIcon:r.icon})}return t}var yo=[{icon:"🔥",label:"Free Caster",blurb:"Raw TAGS grammar, no patron — pure will and improvisation."},{icon:"📖",label:"Runekeeper",blurb:"Bound to one patron via Thiasos or Codex; steady Rites."},{icon:"🔯",label:"Invoker",blurb:"Carries Symbols from multiple patrons; risks Cross-Resonance."},{icon:"🎵",label:"Cantor",blurb:"Sings a patron's Rites as Songs; Corruption blooms with Pushing."},{icon:"👁️",label:"Summoner",blurb:"Binds spirits from the Bestiary; manages the Leash."},{icon:"🌿",label:"Witch",blurb:"Hedge magic at Thresholds, paid in Shadow, Shame, Identity Strain."},{icon:"🧠",label:"Psion",blurb:"Mind-born power fueled by Mental Strain."},{icon:"🧘",label:"Monk",blurb:"Patron-optional path of Breath States and monastic Techniques."},{icon:"🦅",label:"Familiar Only",blurb:"A bonded companion without a full magic path."},{icon:"🍃",label:"Hedge Gifts",blurb:"Small universal gifts available to any character."}];function wo(e){return`
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:0.4rem;text-align:left;margin-top:0.8rem;">
            ${yo.map(t=>`
                <div style="padding:0.4rem 0.5rem;border-radius:var(--radius);background:var(--bg2);border:1px solid ${t.label===e?"var(--gold)":"var(--border)"};">
                    <div style="display:flex;align-items:center;gap:0.3rem;">
                        <span style="font-size:1.1rem;">${t.icon}</span>
                        <strong style="font-size:0.82rem;${t.label===e?"color:var(--gold);":""}">${t.label}</strong>
                    </div>
                    <div style="font-size:0.68rem;color:var(--text3);margin-top:0.15rem;line-height:1.3;">${t.blurb}</div>
                </div>
            `).join("")}
        </div>
    `}function Mr(e){typeof window.sendToVTT=="function"?window.sendToVTT(e,"System",{isHTML:!0}):console.warn("[Cantor] VTT not available — message not sent.")}function xo(e,t,r,n,o,i=""){return`
        <div style="
            background:var(--bg2);
            border-radius:var(--radius);
            padding:0.5rem 0.8rem;
            border:1px solid var(--border);
            border-left:4px solid var(--gold);
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            max-width: 450px;
            margin:0.1rem 0;
            font-family: inherit;
        ">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.2rem;">
                <div style="display:flex;align-items:center;gap:0.3rem;">
                    <span style="font-size:1.2rem;">${p(r||"🎵")}</span>
                    <span style="font-weight:700;font-size:1.05rem;color:var(--gold);">${p(e)}</span>
                </div>
                <span style="font-size:0.65rem;color:var(--text3);">${p(t||"Cantor")}</span>
            </div>
            ${n?`<div style="font-size:0.8rem;color:var(--text);margin-top:0.2rem;line-height:1.4;">${de(n)}</div>`:""}
            ${o?`<div style="font-size:0.7rem;color:var(--text3);margin-top:0.15rem;">${de(o)}</div>`:""}
            ${i?`<div style="font-size:0.65rem;color:var(--text3);margin-top:0.1rem;">${de(i)}</div>`:""}
        </div>
    `}function $o(e,t,r,n,o,i=""){return`
        <div style="
            background:var(--bg2);
            border-radius:var(--radius);
            padding:0.5rem 0.8rem;
            border:1px solid var(--gold);
            border-left:4px solid var(--gold);
            box-shadow: 0 2px 12px rgba(212,175,55,0.3);
            max-width: 450px;
            margin:0.1rem 0;
            font-family: inherit;
        ">
            <div style="text-align:center;font-size:1.5rem;">🌸🌿🌸</div>
            <div style="text-align:center;font-weight:700;font-size:1.2rem;color:var(--gold);">THE BLOOM</div>
            <div style="text-align:center;font-size:0.9rem;color:var(--text2);">
                ${e?`A song of <strong>${p(e)}</strong> resonates through you.`:"The Weave answers your voice."}
            </div>
            ${i?`<div style="font-size:0.8rem;color:var(--text);margin-top:0.2rem;line-height:1.4;">${de(i)}</div>`:""}
            <div style="margin-top:0.2rem;font-size:0.75rem;color:var(--text3);border-top:1px solid var(--border);padding-top:0.15rem;">
                🌸 Bloom #${r} · Corruption: 0/${o} · Tier ${n}
            </div>
        </div>
    `}async function ko(){try{const e=await fetch("./data/wiki.json");if(e.ok){const t=await e.json();if(t.data&&Array.isArray(t.data))return t.data.filter(r=>r.tags&&Array.isArray(r.tags)&&(r.tags.includes("cantor")||r.tags.includes("magic"))&&(r.tags.includes("talent")||r.tags.includes("prestige")||r.tags.includes("epic")))}}catch{console.warn("Could not load wiki.json for Cantor talents.")}return So()}function So(){return[{id:"cantors-path",title:"Cantor's Path",category:"magic",body:"Required for Cantor. Grants access to Songs and a Corruption Timer (size = Spirit).",tags:["talent","magic","magic-access","cantor","starter","major","passive"],cost:8},{id:"master-cantor",title:"Master Cantor",category:"magic",body:"Once per session, treat a significant Performance roll as one degree better (Miss→Partial, etc.). Once per arc, inspire a community; allies gain +1 die to a single goal for one session. Requires: Performance 4+, Presence 4+, Captivating Performance, Tier III.",tags:["talent","magic","cantor","performance","prestige"],cost:10},{id:"embraced-corruption",title:"Embraced Corruption",category:"magic",body:"Prerequisite: Cantor's Path, Tier II+. You have learned to treat the bloom not as disease but as evolution. When you voluntarily fill your Corruption Timer through Resonant Rites, choose your corruption trait. You may Push Songs without marking Fatigue once per session. After filling your Corruption Timer seven times, develop the Fugal Self: +1 die to all Performance rolls. However, each morning you must test Spirit + Resolve (DV 3) or your Corruption controls your body for the first scene of the day.",tags:["talent","magic","cantor","epic"],cost:12},{id:"high-cantor",title:"High Cantor",category:"magic",body:"Tier II+ prestige talent. Allows weaving Standard Rites into instant, powerful Songs. Each such casting marks your Corruption Timer, but the effects are immediate and devastating.",tags:["talent","magic","cantor","prestige"],cost:18},{id:"shadow-song",title:"Shadow Song (Ikasha's Whisper)",category:"magic",body:"Learn Cradle Song (Low: lull a single target, Resist DV 3, costs 1 Fatigue) and Lockpick's Refrain (Standard: unlock one mundane or warded lock, costs 1 Obligation). Requires: Performance 2+, Presence 2+, Patron: Ikasha.",tags:["talent","magic","cantor","prestige"],cost:7},{id:"desperate-cadence",title:"Desperate Cadence (Malachai's False Note)",category:"magic",body:"Learn The Lucky Pick (Low: reroll a failed Stealth or Subterfuge roll, costs 1 Fatigue and 1 Corruption) and Blood Price (Standard: curse a rival, they suffer -1 die on next heist, costs 2 Fatigue and marks a Reckoning Timer). Requires: Performance 2+, Patron: Malachai.",tags:["talent","magic","cantor","prestige"],cost:7},{id:"velvet-hook",title:"Velvet Hook (Livaea's Whisper)",category:"magic",body:"Learn Golden Tongue (Low: +2 dice to Sway for one social exchange, costs 1 Fatigue) and The Unrefusable Offer (Standard: sing a bargain, target must accept or suffer -2 dice until they do, costs 2 Obligation). Requires: Performance 2+, Presence 2+, Patron: Livaea.",tags:["talent","magic","cantor","prestige"],cost:7},{id:"bound-patron",title:"Bound Patron (Homebrew)",category:"magic",body:"Homebrew — not found in the core rulebooks. Choose one patron. You gain +1 position when singing that patron’s rites, but suffer -1 position when singing any other patron’s rites. Your Corruption is bound to that patron’s bloom table.",tags:["talent","cantor","homebrew","patron","passive"],cost:5}]}async function Br(e){const t=v();if(!t||t.magicPath!=="cantor"){e.innerHTML=`
            <div class="panel" style="padding:1rem;text-align:center;color:var(--text3);">
                <div style="font-size:2rem;">🎵</div>
                <p>Cantor interface is only available for Cantors.</p>
                <p style="font-size:0.85rem;">Select a character with the Cantor magic path.</p>
                ${t?"":`
                    <div style="margin-top:0.5rem;font-weight:600;color:var(--gold);">📚 Magic Paths Reference</div>
                    ${wo("Cantor")}
                `}
            </div>
        `;return}await bt();let r=E();const n=t.learnedTalents||[],o=n.includes("high-cantor"),i=t.boundPatron||t.patron||null;let a=i?vt(r,i):null;i&&!a&&(await bt(!0),r=E(),a=vt(r,i));const s=!!a,c=new Set(["low"]);o&&c.add("standard");function d(P){if(!P)return!0;const I=P.toLowerCase().trim();return c.has(I)}let m=[];if(s)a.rites&&Array.isArray(a.rites)&&(m=a.rites.filter(P=>d(P.tier)).map(P=>({...P,patronId:i,patronName:a.name||a.title,patronIcon:a.icon,patronColor:a.color||"var(--gold)"}))),console.log(`[Cantor] Bound to ${a.name||i}, found ${m.length} rites`);else{const P=Ar(r);console.log(`[Cantor] All patrons loaded: ${P.length}`);const I=P.filter(L=>L.rites&&L.rites.length>0);console.log(`[Cantor] Patrons with rites: ${I.length}`,I.map(L=>`${L.name||L.id}: ${L.rites.length} rites (${L.rites.filter(R=>d(R.tier)).length} allowed)`));for(const L of P)if(L.rites&&Array.isArray(L.rites)){const R=L.rites.filter(N=>d(N.tier));for(const N of R)m.push({...N,patronId:L.id,patronName:L.name||L.title,patronIcon:L.icon,patronColor:L.color||"var(--gold)"})}console.log(`[Cantor] Unbound: found ${m.length} total rites`)}const u={};m.forEach(P=>{const I=P.tier||"Unknown";u[I]=(u[I]||0)+1}),console.log("[Cantor] Rites by tier:",u),m.sort(vo);const f=s?a.corruption||[]:[],h=t.corruption||0,y=t.corruptionMax||t.spirit||1,b=Math.min(100,h/y*100),$=t.bloomCount||0,g=$>=7,w=!!t.fugalSelfControlLost,T=s?Math.min(f.length,Math.floor(h/2)+1):0,S=h>=y,x=t.resonantRites||[],z=await ko(),H=s?a.lore?.quotes?.[0]||a.lore?.quote||"Sing, and the Weave answers.":"The Weave speaks through all voices.",B=o?"Low + Standard":"Low";e.innerHTML=`
        <div class="cantor-container" style="display:flex;flex-direction:column;gap:0.6rem;">

            <!-- ─── Header ─────────────────────────────────────── -->
            <div class="cantor-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.3rem;border-bottom:2px solid var(--border);padding-bottom:0.3rem;">
                <div style="display:flex;align-items:center;gap:0.4rem;">
                    <span style="font-size:1.4rem;">🎵</span>
                    <div>
                        <span style="font-weight:600;font-size:1.05rem;color:var(--gold);">Cantor</span>
                        ${s?`<span style="font-size:0.75rem;color:var(--text3);margin-left:0.3rem;">of ${p(a.name||i)}</span>`:'<span style="font-size:0.75rem;color:var(--text3);margin-left:0.3rem;">of the Weave (unbound)</span>'}
                        ${o?'<span style="font-size:0.65rem;color:var(--gold);margin-left:0.2rem;">✨ High Cantor</span>':""}
                        ${s?'<span style="font-size:0.65rem;color:var(--text2);margin-left:0.2rem;">🎯 +1/-1 position</span>':""}
                    </div>
                </div>
                <div style="display:flex;gap:0.3rem;flex-wrap:wrap;">
                    <button class="btn btn-xs btn-secondary" onclick="window.cantorRefresh()" title="Reloads patron data from disk, bypassing any cached copy">🔄 Refresh</button>
                </div>
            </div>

            <!-- ─── Corruption Track ───────────────────────────── -->
            <div class="cantor-corruption-track" style="background:var(--bg2);border-radius:var(--radius);padding:0.4rem 0.6rem;border-left:4px solid ${s?"var(--purple)":"var(--text3)"};">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.2rem;">
                    <div style="display:flex;align-items:center;gap:0.4rem;flex-wrap:wrap;">
                        <span style="font-size:0.85rem;font-weight:600;color:${s?"var(--purple)":"var(--text3)"};">🎵 Corruption</span>
                        <span style="font-size:0.8rem;font-weight:600;">${h}/${y}</span>
                        ${S?`<span style="font-size:0.7rem;color:var(--red);font-weight:600;">⚠️ FULL – ${s?"BLOOM NEAR":"CORRUPTION PEAKED"}</span>`:""}
                    </div>
                    <div style="display:flex;gap:0.2rem;align-items:center;">
                        ${s?`<span style="font-size:0.65rem;color:var(--text3);">Tier ${T}/${f.length}</span>`:'<span style="font-size:0.65rem;color:var(--text3);">Unfocused</span>'}
                        <button class="btn btn-xs btn-secondary" onclick="window.cantorAdvanceCorruption(1)" title="Advance corruption">+</button>
                        <button class="btn btn-xs btn-secondary" onclick="window.cantorAdvanceCorruption(-1)" title="Reduce corruption">−</button>
                        <button class="btn btn-xs btn-ghost" onclick="window.cantorSimulatePush()" style="color:var(--gold);font-size:0.6rem;" title="Preview odds for a normal (un-Pushed) Performance roll">⚡ Simulate Roll</button>
                    </div>
                </div>
                <div style="width:100%;height:8px;background:var(--bg4);border-radius:4px;overflow:hidden;margin-top:0.2rem;">
                    <div style="width:${b}%;height:100%;background:${b>80?"var(--red)":s?"var(--purple)":"var(--text3)"};border-radius:4px;transition:width 0.3s ease;"></div>
                </div>
                <div style="display:flex;justify-content:space-between;font-size:0.6rem;color:var(--text3);margin-top:0.1rem;">
                    <span>${$} blooms</span>
                    <span>${g?"✨ Fugal Self: +1 die to Performance":`${7-$} blooms to Fugal Self`}</span>
                    <span>Resonant Rites: ${x.length}</span>
                </div>
                ${g?`
                    <div style="margin-top:0.3rem;padding-top:0.3rem;border-top:1px dashed var(--border);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.3rem;">
                        <span style="font-size:0.65rem;color:${w?"var(--red)":"var(--text3)"};" title="Grimoire §7.6.4: each morning, test Spirit + Resolve (DV 3) or Corruption controls your body for the first scene of the day.">
                            🌅 Morning Control: ${w?"⚠️ Corruption is in control this scene":"✅ You are in control"}
                        </span>
                        <button class="btn btn-xs btn-secondary" onclick="window.cantorToggleFugalControl()" title="Log the result of today's Spirit + Resolve (DV 3) test">
                            Log Morning Test
                        </button>
                    </div>
                `:""}
            </div>

            <!-- ─── Corruption Table (only if bound) ──────────── -->
            ${s&&f.length>0?`
                <div class="cantor-corruption-table" style="background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;border-left:4px solid var(--purple);">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.2rem;">
                        <span style="font-size:0.8rem;font-weight:600;color:var(--purple);">⚠️ The Bloom: Corruption Tiers</span>
                        <span style="font-size:0.65rem;color:var(--text3);">Unlocked: ${T} / ${f.length}</span>
                    </div>
                    <div style="display:flex;flex-direction:column;gap:0.15rem;max-height:220px;overflow-y:auto;font-size:0.75rem;">
                        ${f.map((P,I)=>{const L=P.tier||I+1,R=I+1<=T,N=O(P.benefit),le=O(P.cost),j=R&&I+1===T;return`
                                <div style="display:grid;grid-template-columns:1fr 2fr 2fr;gap:0.2rem;padding:0.15rem 0.3rem;border-bottom:1px solid var(--border);${j?"background:var(--bg3);border-left:3px solid var(--gold);":""}${R?"":"opacity:0.5;"}">
                                    <span style="font-weight:${R?"600":"400"};color:${j?"var(--gold)":R?"var(--text)":"var(--text3)"};">Tier ${L}</span>
                                    <span style="color:${R?"var(--text)":"var(--text3)"};">${p(N)}</span>
                                    <span style="color:${R?"var(--red)":"var(--text3)"};">${p(le)}</span>
                                </div>
                            `}).join("")}
                    </div>
                    ${S?`
                        <div style="margin-top:0.2rem;padding:0.3rem;background:rgba(212,175,55,0.15);border-radius:var(--radius);border:1px solid var(--gold);font-size:0.75rem;color:var(--gold);">
                            🌸 <strong>The Bloom Beckons!</strong> Your Corruption is full. Perform a <strong>Resonant Rite</strong> to embrace the bloom and advance to the next tier.
                            ${$>=7?"<br>✨ You have achieved the Fugal Self. The bloom is now your ally.":""}
                        </div>
                    `:""}
                </div>
            `:s?"":`
                <div class="cantor-corruption-unbound" style="background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;border-left:4px solid var(--text3);font-size:0.75rem;color:var(--text3);">
                    🌿 Unbound – your corruption is not tied to any patron’s bloom. No tiers or benefits.
                </div>
            `}

            <!-- ─── Songs / Rites ──────────────────────────────── -->
            <div class="cantor-songs" style="background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;border-left:4px solid var(--gold);">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.2rem;flex-wrap:wrap;gap:0.2rem;">
                    <span style="font-size:0.85rem;font-weight:600;color:var(--gold);">🎶 Songs (Rites)</span>
                    <span style="font-size:0.6rem;color:var(--text3);">${m.length} songs${s?"":` (${B})`}${o?" · ✨ Standard included":""}</span>
                    <div style="display:flex;gap:0.2rem;">
                        <button class="btn btn-xs btn-secondary" onclick="window.cantorMarkResonant()">🔮 Resonant Rite</button>
                        <button class="btn btn-xs btn-ghost" onclick="window.cantorResetCorruption()" style="color:var(--red);">✕ Reset</button>
                    </div>
                </div>
                <div id="cantor-rites-container" style="display:flex;flex-direction:column;gap:0.3rem;"></div>
            </div>

            <!-- ─── Resonant Rites Tracker ──────────────────────── -->
            ${x.length>0?`
                <div class="cantor-resonant" style="background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;border-left:4px solid var(--gold);">
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <span style="font-size:0.8rem;font-weight:600;color:var(--gold);">🔮 Resonant Rites Performed</span>
                        <span style="font-size:0.7rem;color:var(--text3);">${x.length}</span>
                    </div>
                    <div style="font-size:0.7rem;color:var(--text2);max-height:60px;overflow-y:auto;">
                        ${x.slice(-5).map(P=>`• ${p(P)}`).join(" ")}
                        ${x.length>5?`<span style="color:var(--text3);">(+${x.length-5} more)</span>`:""}
                    </div>
                    <div style="font-size:0.6rem;color:var(--text3);margin-top:0.1rem;">
                        Resonant Rites advance your Corruption Timer. Each Resonant Rite = +1 Corruption.
                        ${s?$>0?`You have bloomed ${$} time${$>1?"s":""}.`:"":"No bloom without a bound patron."}
                    </div>
                </div>
            `:""}

            <!-- ─── Cantor Talents ──────────────────────────────── -->
            <div class="cantor-talents" style="background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;border-left:4px solid var(--gold);">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.2rem;">
                    <span style="font-size:0.85rem;font-weight:600;color:var(--gold);">⚡ Cantor Talents</span>
                    <span style="font-size:0.6rem;color:var(--text3);">${z.length} talents · ${n.length} learned</span>
                </div>
                <div style="display:flex;flex-direction:column;gap:0.15rem;max-height:180px;overflow-y:auto;font-size:0.75rem;">
                    ${z.map(P=>{const I=O(P.title||P.name),L=O(P.body||P.description),R=P.cost||"?",N=n.includes(P.id||I),le=P.id==="bound-patron",j=!!t.boundPatron;return`
                            <div style="display:flex;justify-content:space-between;align-items:center;padding:0.15rem 0.3rem;border-bottom:1px solid var(--border);${N?"background:var(--bg3);border-left:3px solid var(--gold);":""}">
                                <div style="flex:1;min-width:0;">
                                    <span style="font-weight:${N?"600":"400"};color:${N?"var(--gold)":"var(--text)"};">${p(I)}</span>
                                    ${N?'<span style="font-size:0.55rem;color:var(--gold);margin-left:0.2rem;">✓ Learned</span>':""}
                                    ${le&&j?`<span style="font-size:0.55rem;color:var(--text2);margin-left:0.2rem;">(Bound to ${p(t.boundPatron)})</span>`:""}
                                    <div style="font-size:0.65rem;color:var(--text2);">${de(L)}</div>
                                </div>
                                <div style="display:flex;align-items:center;gap:0.2rem;flex-shrink:0;margin-left:0.3rem;">
                                    <span style="font-size:0.65rem;color:var(--gold);">${R} XP</span>
                                    <button class="btn btn-xs ${N?"btn-secondary":"btn-primary"}" onclick="window.cantorToggleTalent('${p(P.id||I)}')" style="font-size:0.55rem;padding:0.05rem 0.3rem;">
                                        ${N?"✕ Unlearn":"✓ Learn"}
                                    </button>
                                </div>
                            </div>
                        `}).join("")}
                </div>
                <div style="font-size:0.6rem;color:var(--text3);margin-top:0.15rem;">Talents are learned with XP during downtime.</div>
            </div>

            <!-- ─── Cantor Wisdom ──────────────────────────────── -->
            <div class="cantor-wisdom" style="background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;border-left:4px solid var(--gold);">
                <div style="display:flex;flex-direction:column;gap:0.1rem;">
                    <div style="font-size:0.7rem;color:var(--text3);font-style:italic;">
                        "${de(H)}"
                        <span style="display:block;text-align:right;font-size:0.6rem;color:var(--text2);">— ${s?a.name||i:"The Weave"}</span>
                    </div>
                    <div style="display:flex;gap:0.5rem;flex-wrap:wrap;font-size:0.6rem;color:var(--text3);border-top:1px solid var(--border);padding-top:0.15rem;">
                        <span>💡 <strong>Push It:</strong> Resolves instantly, no roll — mark Fatigue + Corruption, GM gains 1 SB</span>
                        ${s?"<span>🌸 <strong>Bloom:</strong> When Corruption is full, perform a Resonant Rite to transform</span>":"<span>🌿 <strong>Unbound:</strong> No bloom – corruption is unfocused</span>"}
                        <span>🎵 <strong>Voice:</strong> Your larynx is older than any tree</span>
                        ${o?"<span>✨ <strong>High Cantor:</strong> Can sing Standard Rites</span>":""}
                        ${g?"<span>🌅 <strong>Fugal Self:</strong> +1 die to Performance, but test Spirit+Resolve (DV 3) each morning</span>":""}
                    </div>
                </div>
            </div>

        </div>
    `;const V=e.querySelector("#cantor-rites-container");V&&To(V,m,t)}function To(e,t,r){if(t.length===0){e.innerHTML=`<div style="font-size:0.8rem;color:var(--text3);text-align:center;">${r.boundPatron?"No songs found for this patron.":"No available rites found across all patrons."}</div>`;return}window._cantorRiteCache=new Map;const n=new Map;t.forEach(i=>{const a=i.patronId||"unbound";n.has(a)||n.set(a,{id:a,name:i.patronName||"Unbound",icon:i.patronIcon||"🌌",color:i.patronColor||"var(--text3)",rites:[]}),n.get(a).rites.push(i),window._cantorRiteCache.set(i.name,i)});let o="";for(const[i,a]of n){const s=i==="unbound"?"🌌 Unbound (all patrons)":`${a.icon} ${a.name}`,c=a.rites.length;o+=`
            <details class="patron-group" style="background:var(--bg3);border-radius:var(--radius);padding:0.2rem 0.4rem;border-left:4px solid ${a.color};">
                <summary style="cursor:pointer;font-weight:600;font-size:0.85rem;color:var(--text);display:flex;justify-content:space-between;align-items:center;padding:0.2rem 0;">
                    <span>${s}</span>
                    <span style="font-size:0.7rem;color:var(--text3);font-weight:400;">${c} rite${c>1?"s":""}</span>
                </summary>
                <div style="display:flex;flex-direction:column;gap:0.3rem;margin-top:0.3rem;padding-left:0.3rem;">
                    ${a.rites.map(d=>Co(d,r)).join("")}
                </div>
            </details>
        `}e.innerHTML=o}function Co(e,t){const r=O(e.name),n=O(e.tier||"Basic"),o=e.xp||e.cost,i=pe(e.xp,0),a=O(e.effect||e.description),s=O(e.push_it),c=s&&s.length>0,d=O(e.cost||""),m=ho(n),u=bo(n),f=e.patronName?O(e.patronName):null,h=e.patronIcon?O(e.patronIcon):null,y=(t.resonantRites||[]).includes(r),b=(t.repertoire||[]).includes(r);return`
        <div class="rite-item" style="background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;border-left:3px solid ${m};${y?"border-right:3px solid var(--gold);":""}${b?"":"opacity:0.75;"}">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.2rem;">
                <div style="display:flex;align-items:center;gap:0.3rem;flex-wrap:wrap;">
                    ${h?`<span style="font-size:1rem;">${h}</span>`:""}
                    <span style="font-weight:600;font-size:0.85rem;">${p(r)}</span>
                    ${f?`<span style="font-size:0.6rem;color:var(--text3);">(${p(f)})</span>`:""}
                    <span style="font-size:0.6rem;color:${m};font-weight:500;">${u} ${p(n)}</span>
                    ${o?`<span style="font-size:0.6rem;color:var(--text3);">${o} XP</span>`:""}
                    ${b?'<span style="font-size:0.55rem;color:var(--green);">✓ In Repertoire</span>':'<span style="font-size:0.55rem;color:var(--text3);">📖 Not yet learned</span>'}
                    ${y?'<span style="font-size:0.55rem;color:var(--gold);">🔮 Resonant</span>':""}
                </div>
                <div style="display:flex;gap:0.2rem;flex-wrap:wrap;">
                    ${d?`<span style="font-size:0.6rem;color:var(--text3);">${p(d)}</span>`:""}
                    ${b?`
                        ${c?`
                            <button class="btn btn-xs btn-primary push-btn" data-rite-name="${p(r)}" onclick="window.cantorPushRite('${p(r)}', this)" title="Push It: resolves instantly with no roll. Mark Fatigue + Corruption; the GM gains 1 SB.">
                                ⚡ Push
                            </button>
                        `:""}
                        <button class="btn btn-xs ${y?"btn-secondary":"btn-ghost"}" 
                                onclick="window.cantorToggleResonantRite('${p(r)}')" 
                                style="${y?"":"color:var(--text3);"}"
                                title="${y?"Unmark as Resonant":"Mark as Resonant Rite (advances Corruption)"}">
                            ${y?"🔮✕":"🔮"}
                        </button>
                    `:`
                        <button class="btn btn-xs btn-gold" onclick="window.cantorLearnSong('${p(r)}', ${i})" title="Add this Song to your Repertoire for ${i} XP">
                            📖 Learn (${i} XP)
                        </button>
                    `}
                </div>
            </div>
            ${a?`<div style="font-size:0.75rem;color:var(--text2);margin-top:0.1rem;line-height:1.3;">${de(a)}</div>`:""}
            ${c&&b?`<div style="font-size:0.65rem;color:var(--text3);margin-top:0.1rem;">⚡ Push: ${de(s)}</div>`:""}
        </div>
    `}window.cantorLearnSong=function(e,t){const r=v();if(!r)return;if(r.repertoire||(r.repertoire=[]),r.repertoire.includes(e)){l(`"${e}" is already in your Repertoire.`,"info");return}const n=r.totalXp||0,o=r.xpSpent||0,i=n-o;if(t>0&&i<t){l(`Not enough XP. Need ${t}, have ${i} available.`,"error");return}confirm(`Add "${e}" to your Repertoire for ${t} XP?`)&&(r.repertoire.push(e),r.xpSpent=o+t,k({repertoire:r.repertoire,xpSpent:r.xpSpent}),l(`🎶 "${e}" added to your Repertoire (${t} XP spent).`,"success"),window.cantorRefresh())};window.cantorPushRite=function(e,t){const r=v();if(!r)return;const n=window._cantorRiteCache?.get(e);if(!n){l("Rite not found. Please refresh.","error");return}if(!(r.repertoire||[]).includes(e)){l(`You haven't learned "${e}" yet — add it to your Repertoire first.`,"error");return}const o=r.fatigue||0,i=r.body||1;if(o>=i){l("Cannot Push — Fatigue track is full!","error");return}const a=1,s=1;r.fatigue=o+a,r.corruption=Math.min((r.corruption||0)+s,r.corruptionMax||r.spirit||1),k({fatigue:r.fatigue,corruption:r.corruption});const c=n.push_it||n.effect||"The song resolves instantly, exactly as sung.";Mr(xo(e,n.patronName||r.boundPatron||"Cantor",n.patronIcon||"🎵",c,`Fatigue +1 · Corruption +1 · GM gains 1 SB (now ${r.fatigue}/${i} Fatigue, ${r.corruption}/${r.corruptionMax||r.spirit||1} Corruption)`,"⚡ Pushed — no roll required, instant success.")),je(`
        <div style="display:flex;flex-direction:column;gap:0.3rem;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
                <span style="font-weight:600;font-size:1rem;color:var(--gold);">⚡ Pushed — Resolves Instantly</span>
            </div>
            <div style="font-size:0.9rem;font-weight:500;">"${p(e)}"</div>
            <div style="font-size:0.75rem;color:var(--text2);">No roll — the song simply succeeds.</div>
            <div style="font-size:0.7rem;color:var(--text3);">${de(c)}</div>
            <div style="border-top:1px solid var(--border);padding-top:0.2rem;font-size:0.75rem;">
                <span style="color:var(--orange);">💪 Fatigue +1</span>
                <span style="color:var(--purple);margin-left:0.5rem;">🎵 Corruption +1</span>
                <span style="color:var(--red);margin-left:0.5rem;">🎭 GM gains 1 SB</span>
                <span style="color:var(--text3);margin-left:0.5rem;">(${r.fatigue}/${i} Fatigue · ${r.corruption}/${r.corruptionMax||r.spirit||1} Corruption)</span>
            </div>
            ${r.corruption>=(r.corruptionMax||r.spirit||1)?`<div style="color:var(--red);font-weight:600;font-size:0.8rem;">${r.boundPatron?"🌸 The bloom is near! Perform a Resonant Rite to transform.":"🌿 Corruption peaked – but without a bound patron, there is no bloom."}</div>`:""}
            <button class="btn btn-xs btn-secondary" onclick="this.closest('div').parentElement.remove()">Close</button>
        </div>
    `,"success"),window.cantorRefresh()};window.cantorSimulatePush=function(){const e=v();if(!e)return;const t=!!(e.boundPatron||e.patron);let r=(e.spirit||1)+(e.performance||0);const n=[];t?(n.push({label:"Bound Patron Rite",pool:r+(e.boundPatronBonus||1),bonus:!0}),n.push({label:"Other Patron Rite",pool:r-1,bonus:!1})):n.push({label:"Any Rite",pool:r,bonus:null});const o=n.map(i=>{const a=[];for(let d=0;d<5;d++){const m=ae(i.pool,4);a.push({successes:m.successes,sb:m.storyBeats||0,success:m.successes>=4})}const s=a.filter(d=>d.success).length,c=a.reduce((d,m)=>d+m.successes,0)/a.length;return`
            <div style="background:var(--bg3);border-radius:var(--radius);padding:0.2rem 0.5rem;margin-top:0.2rem;">
                <div style="font-weight:600;font-size:0.8rem;${i.bonus===!0?"color:var(--gold);":i.bonus===!1?"color:var(--red);":""}">${i.label}</div>
                <div style="font-size:0.75rem;">Pool: ${i.pool}d</div>
                <div style="font-size:0.75rem;">${a.map(d=>d.success?"✅":"❌").join(" ")}</div>
                <div style="font-size:0.7rem;color:var(--text3);">${s}/5 succeed · Avg: ${c.toFixed(1)} successes</div>
            </div>
        `}).join("");je(`
        <div style="display:flex;flex-direction:column;gap:0.3rem;">
            <div style="font-weight:600;font-size:1rem;color:var(--gold);">⚡ Normal Roll Simulation</div>
            <div style="font-size:0.8rem;color:var(--text2);">Base pool: ${r}d (Spirit ${e.spirit||1} + Performance ${e.performance||0})</div>
            ${o}
            <div style="border-top:1px solid var(--border);padding-top:0.2rem;font-size:0.75rem;color:var(--text3);">
                <strong>Reminder:</strong> Pushing a Song skips this roll entirely and guarantees success, for Fatigue +1, Corruption +1, and the GM gaining 1 SB.
            </div>
            <button class="btn btn-xs btn-secondary" onclick="this.closest('div').parentElement.remove()">Close</button>
        </div>
    `,"info")};window.cantorToggleResonantRite=function(e){const t=v();if(!t)return;t.resonantRites||(t.resonantRites=[]);const r=t.resonantRites.indexOf(e);if(r>=0)t.resonantRites.splice(r,1),k({resonantRites:t.resonantRites}),l(`"${e}" unmarked as Resonant.`,"info");else{const n=!!(t.boundPatron||t.patron),o=t.corruption||0,i=t.corruptionMax||t.spirit||1,a=o>=i;if(t.resonantRites.push(e),t.corruption=Math.min(o+1,i),k({resonantRites:t.resonantRites,corruption:t.corruption}),a||t.corruption>=i)if(n){const s=(t.bloomCount||0)+1;t.bloomCount=s,k({bloomCount:t.bloomCount});const c=E(),d=t.boundPatron||t.patron,m=d?vt(c,d):null;let u=0;m?.corruption?.length&&(u=m.corruption.length);const f=Math.min((t.corruption||0)>0?Math.floor(t.corruption/2)+1:1,u||1);Mr($o(m?.name||d||"Unknown",m?.icon||"🌸",s,f,i,m?.corruption?.[f-1]?.benefit||"The bloom transforms you.")),je(`
                    <div style="display:flex;flex-direction:column;gap:0.3rem;">
                        <div style="font-size:1.2rem;text-align:center;">🌸🌿🌸</div>
                        <div style="font-weight:600;font-size:1.1rem;color:var(--gold);text-align:center;">THE BLOOM</div>
                        <div style="font-size:0.9rem;color:var(--text2);text-align:center;">
                            "${p(e)}" resonates through you.<br>
                            You have bloomed <strong>${s}</strong> time${s>1?"s":""}.
                        </div>
                        <div style="border-top:1px solid var(--border);padding-top:0.2rem;font-size:0.8rem;color:var(--text3);">
                            Corruption: ${t.corruption}/${i} · Tier ${f}/${u||"?"}
                            ${s>=7?"<br>✨ <strong>Fugal Self achieved!</strong> +1 die to all Performance rolls — but each morning, test Spirit + Resolve (DV 3) or Corruption controls your body for the first scene.":""}
                        </div>
                        <div style="font-size:0.65rem;color:var(--text3);font-style:italic;text-align:center;">
                            "The bloom is not an ending. It is a beginning."
                        </div>
                        <button class="btn btn-xs btn-secondary" onclick="this.closest('div').parentElement.remove()">Close</button>
                    </div>
                `,"success")}else je(`
                    <div style="display:flex;flex-direction:column;gap:0.3rem;">
                        <div style="font-size:1.2rem;text-align:center;">🌿</div>
                        <div style="font-weight:600;font-size:1rem;color:var(--text3);text-align:center;">Corruption Peaked</div>
                        <div style="font-size:0.9rem;color:var(--text2);text-align:center;">
                            Your corruption is full, but without a bound patron, there is no bloom.
                            You remain unbound.
                        </div>
                        <button class="btn btn-xs btn-secondary" onclick="this.closest('div').parentElement.remove()">Close</button>
                    </div>
                `,"warning");else l(`🔮 "${e}" marked as Resonant! Corruption +1.`,"info")}window.cantorRefresh()};window.cantorMarkResonant=function(){l("Click the 🔮 button on a rite to mark it as Resonant.","info")};window.cantorAdvanceCorruption=function(e=1){const t=v();if(!t)return;const r=t.corruption||0,n=t.corruptionMax||t.spirit||1;t.corruption=Math.max(0,Math.min(r+e,n)),k({corruption:t.corruption}),window.cantorRefresh(),t.corruption>=n?t.boundPatron||t.patron?l("🌸 Corruption is full! Perform a Resonant Rite to bloom.","warning"):l("🌿 Corruption is full – but you are unbound. No bloom.","warning"):l(`Corruption: ${t.corruption}/${n}`,"info")};window.cantorResetCorruption=function(){const e=v();e&&confirm("Reset Corruption, Resonant Rites, and Bloom count?")&&(e.corruption=0,e.resonantRites=[],e.bloomCount=0,k({corruption:0,resonantRites:[],bloomCount:0}),l("Corruption reset.","info"),window.cantorRefresh())};window.cantorToggleFugalControl=function(){const e=v();if(e){if((e.bloomCount||0)<7){l("Fugal Self only applies once you have bloomed 7 times.","info");return}e.fugalSelfControlLost=!e.fugalSelfControlLost,k({fugalSelfControlLost:e.fugalSelfControlLost}),l(e.fugalSelfControlLost?"⚠️ Corruption controls your body for the first scene today.":"✅ You held control this morning.",e.fugalSelfControlLost?"warning":"success"),window.cantorRefresh()}};window.cantorToggleTalent=function(e){const t=v();if(!t)return;t.learnedTalents||(t.learnedTalents=[]);const r=t.learnedTalents.indexOf(e);if(r>=0)e==="bound-patron"&&(t.boundPatron=null,k({boundPatron:null})),t.learnedTalents.splice(r,1),l(`Unlearned: ${e}`,"info");else if(e==="bound-patron"){const n=Ar(E());if(n.length===0){l("No patrons available. Please load patron data first.","error");return}je(`
                <div style="display:flex;flex-direction:column;gap:0.5rem;">
                    <p style="font-weight:600;">Choose a patron to bind to:</p>
                    <select id="bound-patron-select" style="padding:0.3rem;border-radius:var(--radius);background:var(--bg2);color:var(--text);border:1px solid var(--border);">
                        ${n.map(o=>`<option value="${o.id}">${o.icon||"🔮"} ${o.name||o.title}</option>`).join("")}
                    </select>
                    <div style="display:flex;gap:0.5rem;">
                        <button class="btn btn-primary" id="bound-patron-confirm">Bind</button>
                        <button class="btn btn-secondary" id="bound-patron-cancel">Cancel</button>
                    </div>
                </div>
            `,"info"),setTimeout(()=>{const o=document.getElementById("bound-patron-confirm"),i=document.getElementById("bound-patron-cancel"),a=document.getElementById("bound-patron-select");o&&o.addEventListener("click",()=>{const s=a.value;if(s){t.boundPatron=s,t.boundPatronBonus=1,t.learnedTalents.includes(e)||t.learnedTalents.push(e),k({boundPatron:s,boundPatronBonus:1,learnedTalents:t.learnedTalents}),l(`Bound to ${s}`,"success"),window.cantorRefresh();const c=document.querySelector(".toast-container")?.lastElementChild;c&&c.remove()}}),i&&i.addEventListener("click",()=>{const s=document.querySelector(".toast-container")?.lastElementChild;s&&s.remove()})},100);return}else t.learnedTalents.push(e),l(`Learned: ${e} ✨`,"success");k({learnedTalents:t.learnedTalents}),window.cantorRefresh()};window.cantorRefresh=async function(){l("🔄 Reloading patron data from disk…","info"),await bt(!0);const e=document.querySelector(".cantor-container")?.parentElement||document.getElementById("spellcraft-content");e&&await Br(e),l("✅ Cantor refreshed.","success")};function je(e,t="info"){if(typeof window.spellbookShowToastWithHTML=="function"){window.spellbookShowToastWithHTML(e,t);return}const r=document.createElement("div");r.style.cssText=`
        position: fixed; bottom: 1rem; right: 1rem; z-index: 9999;
        animation: toastFadeIn 0.2s ease;
    `;const n=document.createElement("div");if(n.style.cssText=`
        background: var(--bg1); padding: 1.2rem; border-radius: var(--radius);
        max-width: 420px; width: 90vw; border: 1px solid var(--border);
        box-shadow: 0 8px 32px rgba(0,0,0,0.5);
        max-height: 60vh; overflow-y: auto;
    `,n.innerHTML=e+`<br><button class="btn btn-xs btn-secondary" onclick="this.closest('div').parentElement.remove()">Close</button>`,r.appendChild(n),document.body.appendChild(r),!document.getElementById("toast-animation-style")){const o=document.createElement("style");o.id="toast-animation-style",o.textContent=`
            @keyframes toastFadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        `,document.head.appendChild(o)}setTimeout(()=>{r.parentNode&&r.remove()},12e3)}var yt={telekinesis:{id:"telekinesis",label:"Telekinesis",keyAttribute:"spirit",alternateAttribute:"wits",description:"Move objects with the mind. Lift, push, pull, or manipulate.",baseDv:2,strainCost:1,effectExamples:["Light object (cup, tool): DV 2, Strain 1","Medium object (furniture, person): DV 4, Strain 2","Heavy object (cart, boulder): DV 5+, Strain 3"],sbModifiers:{light:0,medium:1,heavy:2}},telepathy:{id:"telepathy",label:"Telepathy",keyAttribute:"wits",alternateAttribute:"presence",description:"Read minds, communicate silently, or implant thoughts.",baseDv:2,strainCost:1,effectExamples:["Surface thoughts: DV 2, Strain 1","Emotional state: DV 3, Strain 1","Deep memories: DV 5, Strain 2"],sbModifiers:{surface:0,emotional:1,deep:2}},clairvoyance:{id:"clairvoyance",label:"Clairvoyance",keyAttribute:"wits",alternateAttribute:"spirit",description:"Perceive distant or hidden things. Scry locations, see through obstacles.",baseDv:2,strainCost:1,effectExamples:["Near range (within sight): DV 2, Strain 1","Distant (beyond sight): DV 4, Strain 2","Complex scry (detailed): DV 5+, Strain 3"],sbModifiers:{near:0,distant:1,complex:2}},biofeedback:{id:"biofeedback",label:"Biofeedback",keyAttribute:"spirit",alternateAttribute:"wits",description:"Control bodily functions. Heal wounds, purge toxins, enhance physical performance.",baseDv:2,strainCost:1,effectExamples:["Stabilize, close minor wounds: DV 2, Strain 1","Heal up to Psionics levels in Harm: DV 3, Strain 2","Major healing or physical enhancement: DV 4+, Strain 3"],sbModifiers:{minor:0,moderate:1,major:2}},astralProjection:{id:"astralProjection",label:"Astral Projection",keyAttribute:"spirit",alternateAttribute:"wits",description:"Project your consciousness outside your body. Travel as a shade.",baseDv:3,strainCost:1,effectExamples:["Near range (within sight): DV 3, Strain 1 per scene","Distant (beyond sight): DV 5, Strain 2 per scene","Extended (multiple scenes): +1 SB per additional scene"],sbModifiers:{near:1,distant:2,extended:1}},psychicAssault:{id:"psychicAssault",label:"Psychic Assault",keyAttribute:"spirit",alternateAttribute:"wits",description:"Attack a target’s mind directly, bypassing physical armor.",baseDv:2,strainCost:1,effectExamples:["Minor assault (stun, headache): DV 2, Strain 1","Moderate assault (mental Harm 1): DV 4, Strain 2","Severe assault (Harm 2+): DV 5+, Strain 3"],sbModifiers:{minor:1,moderate:2,severe:3}},mindShield:{id:"mindShield",label:"Mind Shield",keyAttribute:"wits",alternateAttribute:"spirit",description:"Protect yourself or others from mental intrusion and psychic attacks.",baseDv:2,strainCost:1,effectExamples:["Self only: DV 2, Strain 1","Protect one ally: DV 3, Strain 2","Area shield (Near range): DV 4+, Strain 3"],sbModifiers:{self:0,ally:1,area:2}},empathicManipulation:{id:"empathicManipulation",label:"Empathic Manipulation",keyAttribute:"presence",alternateAttribute:"wits",description:"Sway emotions, calm rage, or inspire courage.",baseDv:2,strainCost:1,effectExamples:["Subtle nudge (calm nerves): DV 2, Strain 1","Moderate shift (calm a crowd): DV 4, Strain 2","Strong manipulation (break morale): DV 5+, Strain 3"],sbModifiers:{subtle:0,moderate:1,strong:2}},precognition:{id:"precognition",label:"Precognition",keyAttribute:"spirit",alternateAttribute:"wits",description:"Glimpse future possibilities. Gain advantage on rolls or avoid dangers.",baseDv:2,strainCost:1,effectExamples:["Minor glimpse (advantage on next roll): DV 2, Strain 1","Moderate (avoid a specific danger): DV 4, Strain 2","Detailed (see multiple branches): DV 5+, Strain 3"],sbModifiers:{minor:1,moderate:2,detailed:3}}},ct=[{id:"order-unstruck-bell",label:"Order of the Unstruck Bell",description:"Aelerian monks who maintain quiet zones. You carry a null-bell that only you can hear.",mechanics:["Once per session, ring your null-bell to gain +1 Position on a single Mind Shield or Telepathy roll.","Resonant Exhale: Once per scene, reduce Mental Strain by 1 (min 0). The GM gains 1 Story Beat.","Gallery-Bound: Ignore first level of environmental penalty from underground or confined spaces when using psionic Arts."],cost:6},{id:"order-empty-circle",label:"Order of the Empty Circle",description:"Nomadic monks of the Violet Steppe who meditate in a psionics-null zone.",mechanics:["Circle-Trained: Once per session, when you would generate a Story Beat from Mental Strain on a non-psionic roll, cancel that SB by marking 1 Fatigue.","Still Mind: For a scene, you may choose to operate at reduced capacity: non-psionic actions generate 1 fewer SB from Mental Strain, but you cannot use any Art above Tier I (DV 2–3).","Herd Sense: Gain +1 die to detect emotional states (anger, fear, calm) in any creature within Near range."],cost:6},{id:"order-shared-breath",label:"Order of the Shared Breath",description:"Island monks who practice paired meditation, sharing Mental Strain across a Circle.",mechanics:["Circle Bond: Form a mental link with up to 3 willing allies (they need not be psions). The link lasts for one scene.","Shared Burden: When you generate Mental Strain, you may transfer any amount to another Circle member within Near range. The GM gains 1 Story Beat each time you use this technique.","Circle's Breath: While linked, all linked members gain +1 die to all psionic rolls; if one member fails a Resolve test against fear or mental intrusion, all members test at +1 DV."],cost:6}];async function zo(){try{const e=await fetch("./data/wiki.json");if(e.ok){const t=await e.json();if(t.data&&Array.isArray(t.data))return t.data.filter(r=>r.tags&&Array.isArray(r.tags)&&(r.tags.includes("psion")||r.tags.includes("magic"))&&(r.tags.includes("talent")||r.tags.includes("prestige")||r.tags.includes("epic")))}}catch{console.warn("Could not load wiki.json for Psion talents.")}return Po()}function Po(){return[{id:"craft-of-the-psion",title:"Craft of the Psion",category:"magic",body:"Required for Psion. Grants access to Psionic Arts and the Mental Strain track. You gain the Psionics skill at rating 1 and may learn Arts as talents.",tags:["talent","magic","psion"],cost:4},{id:"telekinetic-mastery",title:"Telekinetic Mastery",category:"magic",body:"Once per session, reroll a failed Telekinesis roll. In addition, reduce the DV of Telekinesis effects by 1 (min 2).",tags:["talent","magic","psion"],cost:6},{id:"mental-fortress",title:"Mental Fortress",category:"magic",body:"+1 die to resist mental intrusion. Once per session, you may ignore the first Mental Strain cost of a Mind Shield effect.",tags:["talent","magic","psion"],cost:5},{id:"psychic-reservoir",title:"Psychic Reservoir",category:"magic",body:'You may store up to 2 Mental Strain as "reserve" that does not count toward your maximum. This reserve can be used to pay strain costs, but it recovers only after a full night’s rest.',tags:["talent","magic","psion"],cost:8},{id:"thought-thief",title:"Thought Thief",category:"magic",body:"When you successfully read a target’s deep memories with Telepathy, you may learn one of their Strings (a secret, a bond, a weakness). The GM must reveal it.",tags:["talent","magic","psion"],cost:7},{id:"echo-dampener",title:"Echo Dampener",category:"magic",body:"Once per scene, you may reduce the Story Beat generation from a failed psionic roll by 1 (minimum 0). Mark 1 Fatigue to do so.",tags:["talent","magic","psion"],cost:5},...ct.map(e=>({id:e.id,title:e.label,category:"magic",body:e.description+"<br><br>"+e.mechanics.map(t=>"• "+t).join("<br>"),tags:["talent","magic","psion","order"],cost:e.cost}))]}function Xt(e){typeof window.sendToVTT=="function"?window.sendToVTT(e,"System",{isHTML:!0}):console.warn("[Psion] VTT not available — message not sent.")}function Kt(e,t,r,n,o,i,a=""){return`
        <div style="
            background:var(--bg2);
            border-radius:var(--radius);
            padding:0.5rem 0.8rem;
            border:1px solid var(--border);
            border-left:4px solid var(--blue);
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            max-width: 450px;
            margin:0.1rem 0;
            font-family: inherit;
        ">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.2rem;">
                <div style="display:flex;align-items:center;gap:0.3rem;">
                    <span style="font-size:1.2rem;">🧠</span>
                    <span style="font-weight:700;font-size:1.05rem;color:var(--blue);">${p(e)}</span>
                </div>
                <span style="font-size:0.65rem;color:var(--text3);">${p(t||"Psion")}</span>
            </div>
            ${r?`<div style="font-size:0.75rem;color:var(--text3);">Target: ${p(r)}</div>`:""}
            ${n?`<div style="font-size:0.8rem;color:var(--text);margin-top:0.2rem;line-height:1.4;">${Le(n)}</div>`:""}
            ${o?`<div style="font-size:0.75rem;color:var(--text2);margin-top:0.1rem;">${Le(o)}</div>`:""}
            ${i?`<div style="font-size:0.7rem;color:var(--text3);margin-top:0.15rem;">${Le(i)}</div>`:""}
            ${a?`<div style="font-size:0.65rem;color:var(--text3);margin-top:0.1rem;">${Le(a)}</div>`:""}
        </div>
    `}function ne(e){if(e==null)return"";if(typeof e=="string")return e;if(typeof e=="number"||typeof e=="boolean")return String(e);if(Array.isArray(e))return e.map(t=>ne(t)).join(", ");if(typeof e=="object"){if(e.name)return ne(e.name);if(e.label)return ne(e.label);if(e.description)return ne(e.description);if(e.effect)return ne(e.effect);if(e.text)return ne(e.text);if(e.quote)return ne(e.quote);if(e.lore)return ne(e.lore);try{return JSON.stringify(e)}catch{return"[object]"}}return String(e)}function Le(e){return e?p(e).replace(/\n/g,"<br>"):""}function Lr(e){return yt[e]||null}function Ht(e){return e.psionics||0}function Dt(e){return e.mentalStrain||0}function Ee(e){return Math.max(2,e.spirit||1)}function Er(e){return e.learnedArts||[]}function Ro(e){const t=e.learnedTalents||[];for(const r of ct)if(t.includes(r.id))return r.id;return null}async function Ir(e){const t=v();if(!t||t.magicPath!=="psion"){e.innerHTML=`
            <div class="panel" style="padding:1rem;text-align:center;color:var(--text3);">
                <div style="font-size:2rem;">🧠</div>
                <p>Psionics interface is only available for Psions.</p>
                <p style="font-size:0.85rem;">Select a character with the Psion magic path.</p>
            </div>
        `;return}t.psionics===void 0&&(t.psionics=0),t.mentalStrain===void 0&&(t.mentalStrain=0),t.learnedArts===void 0&&(t.learnedArts=[]);const r=Ht(t),n=Dt(t),o=Ee(t),i=Math.min(100,n/o*100),a=Er(t),s=t.learnedTalents||[],c=Ro(t),d=await zo(),m=s.includes("craft-of-the-psion");e.innerHTML=`
        <div class="psion-container" style="display:flex;flex-direction:column;gap:0.6rem;">

            <!-- ─── Header ─────────────────────────────────────── -->
            <div class="psion-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.3rem;border-bottom:2px solid var(--border);padding-bottom:0.3rem;">
                <div style="display:flex;align-items:center;gap:0.4rem;">
                    <span style="font-size:1.4rem;">🧠</span>
                    <div>
                        <span style="font-weight:600;font-size:1.05rem;color:var(--blue);">Psion</span>
                        ${c?`<span style="font-size:0.75rem;color:var(--text3);margin-left:0.3rem;">(${ct.find(u=>u.id===c)?.label||c})</span>`:""}
                        <span style="font-size:0.75rem;color:var(--text3);margin-left:0.3rem;">Skill: ${r}</span>
                    </div>
                </div>
                <div style="display:flex;gap:0.3rem;flex-wrap:wrap;">
                    <button class="btn btn-xs btn-secondary" onclick="window.psionRefresh()">🔄 Refresh</button>
                </div>
            </div>

            <!-- ─── Mental Strain Track ────────────────────────── -->
            <div class="psion-strain-track" style="background:var(--bg2);border-radius:var(--radius);padding:0.4rem 0.6rem;border-left:4px solid var(--blue);">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.2rem;">
                    <div style="display:flex;align-items:center;gap:0.4rem;flex-wrap:wrap;">
                        <span style="font-size:0.85rem;font-weight:600;color:var(--blue);">🧠 Mental Strain</span>
                        <span style="font-size:0.8rem;font-weight:600;">${n}/${o}</span>
                        ${n>=o?'<span style="font-size:0.7rem;color:var(--red);font-weight:600;">⚠️ OVERFLOW – Risk of Harm!</span>':""}
                    </div>
                    <div style="display:flex;gap:0.2rem;align-items:center;">
                        <button class="btn btn-xs btn-secondary" onclick="window.psionAdjustStrain(1)" title="Increase Strain">+</button>
                        <button class="btn btn-xs btn-secondary" onclick="window.psionAdjustStrain(-1)" title="Decrease Strain">−</button>
                    </div>
                </div>
                <div style="width:100%;height:8px;background:var(--bg4);border-radius:4px;overflow:hidden;margin-top:0.2rem;">
                    <div style="width:${i}%;height:100%;background:${i>80?"var(--red)":"var(--blue)"};border-radius:4px;transition:width 0.3s ease;"></div>
                </div>
                <div style="display:flex;justify-content:space-between;font-size:0.6rem;color:var(--text3);margin-top:0.1rem;">
                    <span>Arts learned: ${a.length}</span>
                    <span>${m?"✅ Craft of the Psion":"❌ Craft of the Psion required"}</span>
                </div>
            </div>

            <!-- ─── Arts List ───────────────────────────────────── -->
            <div class="psion-arts" style="background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;border-left:4px solid var(--blue);">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.2rem;flex-wrap:wrap;gap:0.2rem;">
                    <span style="font-size:0.85rem;font-weight:600;color:var(--blue);">🧩 Psionic Arts</span>
                    <span style="font-size:0.6rem;color:var(--text3);">${Object.keys(yt).length} arts · ${a.length} learned</span>
                </div>
                ${m?"":`
                    <div style="padding:0.3rem;background:rgba(212,175,55,0.15);border-radius:var(--radius);font-size:0.75rem;color:var(--gold);margin-bottom:0.3rem;">
                        ⚠️ You need the <strong>Craft of the Psion</strong> talent to use psionic Arts.
                    </div>
                `}
                <div id="psion-arts-container" style="display:flex;flex-direction:column;gap:0.3rem;">
                    ${Object.entries(yt).map(([u,f])=>{const h=a.includes(u),y=f.effectExamples.map((b,$)=>{const g=b.match(/DV (\d+)/),w=g?parseInt(g[1]):2,T=b.match(/Strain (\d+)/);return`<option value="${$}" data-dv="${w}" data-strain="${T?parseInt(T[1]):1}">${p(b)}</option>`}).join("");return`
                            <div class="psion-art-item" data-art-id="${u}" style="background:var(--bg3);border-radius:var(--radius);padding:0.2rem 0.5rem;border-left:3px solid ${h?"var(--blue)":"var(--text3)"};${h?"":"opacity:0.5;"}">
                                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.2rem;">
                                    <div style="display:flex;align-items:center;gap:0.3rem;flex-wrap:wrap;">
                                        <span style="font-weight:600;font-size:0.85rem;">${p(f.label)}</span>
                                        <span style="font-size:0.6rem;color:var(--text3);">${p(f.keyAttribute)}</span>
                                        ${h?'<span style="font-size:0.55rem;color:var(--blue);">✓ Learned</span>':'<span style="font-size:0.55rem;color:var(--text3);">Not learned</span>'}
                                    </div>
                                    <div style="display:flex;gap:0.2rem;flex-wrap:wrap;">
                                        ${h?`
                                            <button class="btn btn-xs btn-secondary" onclick="window.psionUseArt('${u}')" title="Use this Art (inline controls below)">⚡ Use</button>
                                        `:""}
                                        <button class="btn btn-xs ${h?"btn-secondary":"btn-primary"}" onclick="window.psionToggleArt('${u}')" style="font-size:0.55rem;padding:0.05rem 0.3rem;">
                                            ${h?"✕ Unlearn":"✓ Learn"}
                                        </button>
                                    </div>
                                </div>
                                <div style="font-size:0.7rem;color:var(--text2);margin-top:0.1rem;">${p(f.description)}</div>
                                <div style="font-size:0.65rem;color:var(--text3);margin-top:0.05rem;display:flex;flex-wrap:wrap;gap:0.2rem 0.5rem;">
                                    ${f.effectExamples.map(b=>`<span>${p(b)}</span>`).join(" · ")}
                                </div>
                                ${h?`
                                    <div class="psion-inline-controls" style="margin-top:0.2rem;display:flex;gap:0.3rem;align-items:center;flex-wrap:wrap;background:var(--bg2);padding:0.2rem 0.3rem;border-radius:var(--radius);border:1px solid var(--border);">
                                        <select class="psion-effect-select" style="font-size:0.7rem;background:var(--bg3);border:1px solid var(--border);border-radius:4px;padding:0.1rem 0.3rem;">
                                            ${y}
                                        </select>
                                        <input type="text" class="psion-target-input" placeholder="Target" style="font-size:0.7rem;width:100px;background:var(--bg3);border:1px solid var(--border);border-radius:4px;padding:0.1rem 0.3rem;">
                                        <button class="btn btn-xs btn-primary" onclick="window.psionPerformArtFromInline('${u}', this)">⚡ Use</button>
                                    </div>
                                `:""}
                            </div>
                        `}).join("")}
                </div>
            </div>

            <!-- ─── Psion Talents ───────────────────────────────── -->
            <div class="psion-talents" style="background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;border-left:4px solid var(--blue);">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.2rem;">
                    <span style="font-size:0.85rem;font-weight:600;color:var(--blue);">⚡ Psion Talents</span>
                    <span style="font-size:0.6rem;color:var(--text3);">${d.length} talents · ${s.length} learned</span>
                </div>
                <div style="display:flex;flex-direction:column;gap:0.15rem;max-height:200px;overflow-y:auto;font-size:0.75rem;">
                    ${d.map(u=>{const f=ne(u.title||u.name),h=ne(u.body||u.description),y=u.cost||"?",b=s.includes(u.id||f),$=u.tags&&u.tags.includes("order");return`
                            <div style="display:flex;justify-content:space-between;align-items:center;padding:0.15rem 0.3rem;border-bottom:1px solid var(--border);${b?"background:var(--bg3);border-left:3px solid var(--blue);":""}">
                                <div style="flex:1;min-width:0;">
                                    <span style="font-weight:${b?"600":"400"};color:${b?"var(--blue)":"var(--text)"};">${p(f)}</span>
                                    ${b?'<span style="font-size:0.55rem;color:var(--blue);margin-left:0.2rem;">✓ Learned</span>':""}
                                    ${$?'<span style="font-size:0.55rem;color:var(--gold);margin-left:0.2rem;">🏛️ Order</span>':""}
                                    <div style="font-size:0.65rem;color:var(--text2);">${Le(h)}</div>
                                </div>
                                <div style="display:flex;align-items:center;gap:0.2rem;flex-shrink:0;margin-left:0.3rem;">
                                    <span style="font-size:0.65rem;color:var(--gold);">${y} XP</span>
                                    <button class="btn btn-xs ${b?"btn-secondary":"btn-primary"}" onclick="window.psionToggleTalent('${p(u.id||f)}')" style="font-size:0.55rem;padding:0.05rem 0.3rem;">
                                        ${b?"✕ Unlearn":"✓ Learn"}
                                    </button>
                                </div>
                            </div>
                        `}).join("")}
                </div>
                <div style="font-size:0.6rem;color:var(--text3);margin-top:0.15rem;">Talents are learned with XP during downtime.</div>
            </div>

            <!-- ─── Psion Wisdom ─────────────────────────────────── -->
            <div class="psion-wisdom" style="background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;border-left:4px solid var(--blue);">
                <div style="display:flex;flex-direction:column;gap:0.1rem;">
                    <div style="font-size:0.7rem;color:var(--text3);font-style:italic;">
                        "I carry no Symbol. My ledger is my skull, and it comes due in headaches, not obligations."
                        <span style="display:block;text-align:right;font-size:0.6rem;color:var(--text2);">— The Gray Wanderer</span>
                    </div>
                    <div style="display:flex;gap:0.5rem;flex-wrap:wrap;font-size:0.6rem;color:var(--text3);border-top:1px solid var(--border);padding-top:0.15rem;">
                        <span>🧠 <strong>Mental Strain:</strong> Overflow causes Harm</span>
                        <span>🎲 <strong>Story Beats:</strong> Each 1 on a psionic roll generates SB</span>
                        <span>🔒 <strong>Silent Orders:</strong> Specialized training</span>
                    </div>
                </div>
            </div>

        </div>
    `}window.psionPerformArtFromInline=function(e,t){const r=v();if(!r)return;if(!Lr(e)){l("Art not found.","error");return}if(Ht(r)<1){l("You need at least 1 point in Psionics skill to use Arts.","error");return}if(!Er(r).includes(e)){l("You have not learned this Art.","error");return}const n=t.closest(".psion-art-item");if(!n){l("Could not find art controls.","error");return}const o=n.querySelector(".psion-effect-select"),i=n.querySelector(".psion-target-input");if(!o){l("Effect selection not found.","error");return}const a=parseInt(o.value),s=o.options[a];Ao(r,e,parseInt(s.dataset.dv)||2,parseInt(s.dataset.strain)||1,i&&i.value.trim()||"a target")};function Ao(e,t,r,n,o){const i=Lr(t);if(!i){l("Art not found.","error");return}const a=Ht(e),s=(e[i.keyAttribute]||1)+a,c=Dt(e),d=Ee(e);if(c+n>d){const S=c+n-d,x=S*2,z=S,H=`Mental Strain would overflow by ${S} points. You can either:
- Pay ${x} Fatigue (standard conversion)
- Pay ${z} Harm (Stress)

Choose "OK" to pay Fatigue, "Cancel" to pay Harm.`;let B=!1,V=0,P="";if(confirm(H)?(e.fatigue=(e.fatigue||0)+x,e.mentalStrain=d,B=!0,V=x,P="Fatigue"):(e.harm=(e.harm||0)+z,e.mentalStrain=d,B=!0,V=z,P="Harm"),B){k({mentalStrain:e.mentalStrain,harm:e.harm,fatigue:e.fatigue}),Xt(Kt(`${i.label} — Overflow`,"Psion",o,`Overflow: ${S} points converted to ${P} ${V}.`,`Mental Strain set to ${d}/${d}.`,`Strain cost would have been ${n}.`,"⚠️ Mental Strain capacity exceeded.")),window.psionRefresh();return}}const m=ae(s,r),u=m.successes>=r,f=m.storyBeats||0;e.mentalStrain=c+n;const h=u?"✅ Success":"❌ Failure",y=`${s}d vs DV ${r} → ${m.successes} successes (rolled: ${m.dice.join(", ")})`,b=`Mental Strain +${n} (now ${e.mentalStrain}/${d})${f>0?` · 🎲 ${f} SB generated`:""}`,$=`${i.label} on ${o}`;Xt(Kt(i.label,"Psion",o,$,y,b,`${h}`));let g=u?"✅ Success":"❌ Failure",w=u?"var(--gold)":"var(--red)",T=u?`The ${i.label} resolves with ${m.successes} successes.`:`The ${i.label} falters with ${m.successes}/${r} successes.`;f>0&&(T+=` ${f} Story Beats generated.`),Mo(`
        <div style="display:flex;flex-direction:column;gap:0.3rem;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
                <span style="font-weight:600;font-size:1rem;color:${w};">${g}</span>
                <span style="font-size:0.75rem;color:var(--text3);">🧠 Psionics</span>
            </div>
            <div style="font-size:0.9rem;font-weight:500;">"${p(i.label)}" on ${p(o)}</div>
            <div style="font-size:0.75rem;color:var(--text2);">${T}</div>
            <div style="border-top:1px solid var(--border);padding-top:0.2rem;font-size:0.75rem;">
                <span style="color:var(--blue);">🧠 Mental Strain +${n}</span>
                <span style="color:var(--text3);margin-left:0.5rem;">(${e.mentalStrain}/${Ee(e)})</span>
                ${f>0?`<span style="color:var(--gold);margin-left:0.5rem;">🎲 ${f} SB</span>`:""}
            </div>
            ${e.mentalStrain>=Ee(e)?'<div style="color:var(--red);font-weight:600;font-size:0.8rem;">⚠️ Mental Strain at maximum! Further strain will cause Harm or Fatigue.</div>':""}
            <button class="btn btn-xs btn-secondary" onclick="this.closest('div').parentElement.remove()">Close</button>
        </div>
    `,u?"success":"warning"),k({mentalStrain:e.mentalStrain}),window.psionRefresh()}window.psionUseArt=function(e){const t=document.querySelector(`.psion-art-item[data-art-id="${e}"]`);if(t){t.scrollIntoView({behavior:"smooth",block:"center"});const r=t.querySelector(".psion-inline-controls");r&&(r.style.transition="background 0.3s",r.style.background="var(--gold)",setTimeout(()=>{r.style.background=""},600)),l("Use the dropdown and target field below the art description.","info")}else l("Art not found. Please refresh.","error")};window.psionToggleArt=function(e){const t=v();if(!t)return;t.learnedArts||(t.learnedArts=[]);const r=t.learnedArts.indexOf(e);if(r>=0)t.learnedArts.splice(r,1),l(`Unlearned: ${e}`,"info");else{if(!(t.learnedTalents||[]).includes("craft-of-the-psion")){l("You must learn Craft of the Psion first.","error");return}t.learnedArts.push(e),l(`Learned Art: ${e}`,"success")}k({learnedArts:t.learnedArts}),window.psionRefresh()};window.psionToggleTalent=function(e){const t=v();if(!t)return;t.learnedTalents||(t.learnedTalents=[]);const r=t.learnedTalents.indexOf(e);r>=0?(ct.some(n=>n.id===e),t.learnedTalents.splice(r,1),l(`Unlearned: ${e}`,"info")):(e==="craft-of-the-psion"&&(!t.psionics||t.psionics<1)&&(t.psionics=1,l("Craft of the Psion learned! Psionics skill set to 1.","success")),t.learnedTalents.push(e),l(`Learned: ${e} ✨`,"success")),k({learnedTalents:t.learnedTalents,psionics:t.psionics}),window.psionRefresh()};window.psionAdjustStrain=function(e){const t=v();if(!t)return;const r=Dt(t),n=Ee(t);let o=Math.max(0,Math.min(r+e,n));if(e>0&&r>=n){l("Mental Strain already at maximum!","warning");return}t.mentalStrain=o,k({mentalStrain:t.mentalStrain}),window.psionRefresh(),l(`Mental Strain: ${o}/${n}`,"info")};window.psionRefresh=function(){const e=document.querySelector(".psion-container")?.parentElement||document.getElementById("spellcraft-content");e&&Ir(e),l("🔄 Psionics refreshed.","info")};function Mo(e,t="info"){if(typeof window.spellbookShowToastWithHTML=="function"){window.spellbookShowToastWithHTML(e,t);return}const r=document.createElement("div");r.style.cssText=`
        position: fixed; bottom: 1rem; right: 1rem; z-index: 9999;
        animation: toastFadeIn 0.2s ease;
    `;const n=document.createElement("div");if(n.style.cssText=`
        background: var(--bg1); padding: 1.2rem; border-radius: var(--radius);
        max-width: 420px; width: 90vw; border: 1px solid var(--border);
        box-shadow: 0 8px 32px rgba(0,0,0,0.5);
        max-height: 60vh; overflow-y: auto;
    `,n.innerHTML=e+`<br><button class="btn btn-xs btn-secondary" onclick="this.closest('div').parentElement.remove()">Close</button>`,r.appendChild(n),document.body.appendChild(r),!document.getElementById("toast-animation-style")){const o=document.createElement("style");o.id="toast-animation-style",o.textContent=`
            @keyframes toastFadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        `,document.head.appendChild(o)}setTimeout(()=>{r.parentNode&&r.remove()},12e3)}var te={none:{label:"No Path",icon:"👤",color:"var(--text3)",description:"No magical path chosen. The Crafting Bench (sidebar) is still available.",longDescription:"You have not yet chosen a magical tradition. Explore the paths below to find the one that calls to you.",recommendations:[]},"free-caster":{label:"Free Caster",icon:"🔮",color:"#8e44ad",description:"Weave the raw Weave using TAGS. No patron required – only will and grammar.",longDescription:"Free Casters reach directly into the Weave, shaping reality through will, word, and gesture. No Patron, no Codex, no Symbol – just you and the raw stuff of creation. The power is intoxicating, but the Backlash is entirely your own.",recommendations:["I want to improvise and invent my own spells","I love the idea of raw, untamed magic","I want to be self-reliant and answer to no Patron"],archetypes:["Sorcerer","Wild Mage","Improviser"],tourDescription:`<p>Free Casters reach directly into the Weave, shaping reality through will, word, and gesture. No Patron, no Codex, no Symbol – just you and the raw stuff of creation.</p>
<p>The power is intoxicating, but the Backlash is entirely your own. You pay in Fatigue, in scars, in moments of reality slipping sideways. The <strong>TAGS</strong> system is your grammar – verbs and nouns of the Weave that let you improvise anything from a spark to a gate.</p>
<p>You are the uncontrolled, the unpredictable, the one who makes the Synod nervous. But you are also free – answerable to no covenant, bound by no oath. The Weave is patient, but it expects precision.</p>
<p><em>"I do not borrow. I speak. And the Weave listens."</em></p>`},runekeeper:{label:"Runekeeper",icon:"📜",color:"#d4af37",description:"Bound to a single Patron. Your Codex and Thiasos are the instruments of your covenant.",longDescription:"Runekeepers are the agents of the great powers – Paladins of Mykkiel, Druids of Grimmir, Artificers of the Clockwork Monad. You serve one Patron, and in return you wield structured, reliable power. Your Codex is your covenant; your Thiasos is your witness.",recommendations:["I want clear, structured power with defined costs","I like the idea of being a paladin, druid, or artificer","I want a deep, committed relationship with a single Patron"],archetypes:["Paladin","Druid","Artificer","Inquisitor","Templar"],tourDescription:`<p>Runekeepers are the agents of the great powers – the ones who speak with authority because they have been granted it. You serve a single Patron, and in return you wield structured, reliable power that is the envy of less disciplined mages.</p>
<p>Your <strong>Codex</strong> is not merely a book – it is a covenant made visible, a record of your service and your Patron's expectations. Your <strong>Thiasos</strong> is a fragment of the Patron's attention, a witness to your deeds.</p>
<p>A Runekeeper of Mykkiel is a Paladin of law. A Runekeeper of Grimmir is a Druid of the wild. A Runekeeper of the Clockwork Monad is an Artificer of impossible geometries. The Patron supplies the theme; the Rites supply the mechanics.</p>
<p><em>"I do not beg. I record. And in the recording, I become the hand that writes the law."</em></p>`},invoker:{label:"Invoker",icon:"🎴",color:"#e67e22",description:"Carry Symbols from multiple Patrons. Power is borrowed, interest is steep.",longDescription:"Invokers are gamblers who carry Symbols – physical anchors to Patrons they have never fully sworn to. They diversify their portfolio of power, juggling obligations like a merchant hedging against ruin. The power is versatile, but the interest is always compounding.",recommendations:["I want flexibility and versatility","I love risk/reward mechanics","I want to be clever and find loopholes"],archetypes:["Warlock","Gambler","Occultist","Hedge-Mage"],tourDescription:`<p>Invokers are the gamblers of the magical world – the ones who carry <strong>Symbols</strong> from multiple Patrons, borrowing power without committing their soul to any one master. They are the ultimate pragmatists.</p>
<p>Each Symbol is a contract made tangible: a ring, a seal, a blackened coin. The Invoker does not ask what a Patron wants; they determine what a Patron lacks. They trade in obligations, juggling debts with the precision of a merchant.</p>
<p>When the knife is at the throat, the Invoker <strong>Cracks the Seal</strong> – invoking a Rite instantly, calling in the weight as an emergency loan. The price is never small, but the power is undeniable.</p>
<p><em>"I do not kneel. I sign. I do not pray. I calculate."</em></p>`},cantor:{label:"Cantor",icon:"🎵",color:"#6b4c9a",description:"Your voice is the instrument. Sing the old songs, and the Weave answers – at a cost.",longDescription:"Cantors are the wild singers, the mad pipers, the hymn-leaders who become the altar. They do not swear to Patrons – they echo them. Their power is intimacy, unmediated and deeply dangerous. The voice that sings too often to the storm begins to carry thunder in its timbre.",recommendations:["I love social/performance scenes","I enjoy tragic corruption arcs","I want power that is literally part of my body"],archetypes:["Bard","Siren","Storm-Singer","Prophet"],tourDescription:`<p>Cantors are the wild singers, the mad pipers, the hymn-leaders who become the altar. They do not swear to Patrons – they <strong>echo</strong> them. Their power is intimacy, unmediated and deeply dangerous.</p>
<p>They require no focus but their own bodies. A Cantor without a voice can tap rhythm on their ribs. One without hands can whistle through their teeth. The body remembers the song even when the mind has forgotten it.</p>
<p><strong>Corruption</strong> for a Cantor is not a debt – it is a transformation undergone. The voice develops harmonics that should not exist. The breath carries scents from places not on any map. Some grow feathers in their hair; others find their shadows lagging half a step behind.</p>
<p><em>"You think you need a lute? My larynx is older than any tree. Hum, and the world will listen. Scream, and it might answer back."</em></p>`},witch:{label:"Witch",icon:"🧹",color:"#27ae60",description:"Threshold magic, hedge gifts, and the quiet work of names. The hedge keeps the wolves at bay.",longDescription:"Witches practice the systemic magic that maintains the world – the quiet, overlooked power that is at once invisible and essential. They work with knots, thresholds, and the accumulated weight of stories. Their magic is intimate, corrupting in the old sense: not rotten, but changed.",recommendations:["I like subtlety and preparation over flashy magic","I enjoy folk horror and domestic magic","I want to be underestimated and overlooked"],archetypes:["Hedge-Witch","Hearth-Mother","Knot-Weaver","Threshold-Keeper"],tourDescription:`<p>Witches practice the systemic magic that maintains the world – the quiet, overlooked power that is at once invisible and essential. They are the ones who know that a threshold must be swept three times counter-timerwise to keep the Hollow from noticing it.</p>
<p>Their magic is organic, grown from relationships with places and spirits that have no names in any grimoire. They work with the Ninth, with thresholds, with the accumulated weight of stories.</p>
<p>Every culture has Witches, though they call them different things – Hedge-Mothers, Breath-Wardens, Map-Adjusters, Cistern-Keepers. They are the ones who remember that magic is not merely for throwing fireballs but for ensuring that the fire does not burn down the village.</p>
<p><em>"The hedge is what keeps the wolves from the flock. I am the one who tends the hedge."</em></p>`},psion:{label:"Psion",icon:"🧠",color:"#2980b9",description:"The mind is the only focus. Mental Strain is the price of bending reality with will alone.",longDescription:"Psions look only to the self – the disciplined, trained, dangerous self. They carry no outward signs of their power. No glowing staff, no familiar, no song to warn you. They are accountable only to themselves, and in a world built on bonds and covenants, this makes them suspect. The mind is a fortress with no gates – safe until it isn't.",recommendations:["I prefer internal struggle over external debts","I like mind games and subtlety","I dislike carrying obvious magical gear"],archetypes:["Mind-Mage","Telepath","Psychic","Monk"],tourDescription:`<p>Psions are the isolated ones, the untrusted, the inward-turned. Where other paths borrow from outside powers, the Psion looks only to the self – the disciplined, trained, dangerous self. They carry no outward signs of their power.</p>
<p>Their power is attrition. They pay not in Obligation but in themselves – every thought bent, every future glimpsed, every object moved by will alone leaves a hairline crack in the vessel. <strong>Mental Strain</strong> is the ledger of this cost.</p>
<p>They are hunted by the Chain-Lanterns of Ecktoria, licensed by the Synod of Thepyrgos, sealed in vaults by the Aeler, and shunned by the hearth-keepers of Aelaerem. They carry no outward sign. They are accountable only to themselves – and to the Mind's Ledger, which never forgets a weight.</p>
<p><em>"I carry no Symbol. I keep no Codex. My power has no scent, no sound, no outward sign. And that is why they fear me most of all."</em></p>`},summoner:{label:"Summoner",icon:"👁️",color:"#c0392b",description:"Bind spirits with the Leash. Negotiate, command, and hope the price is worth the service.",longDescription:"Summoners are the diplomats of the damned and the blessed alike – the ones who open doors and hope to close them before something follows through. The dead, the fey, the demons, the angels – they are all spirits, and they all speak the language of contract. The Leash is a courtesy extended by the spirit while it finds your measure.",recommendations:['I like tactical "pet" management and action economy',"I enjoy contracts, diplomacy, and bargaining with monsters",'I want a "friend" that might eat me'],archetypes:["Necromancer","Demonologist","Spirit-Binder","Shaman"],tourDescription:`<p>Summoners are the diplomats of the damned and the blessed alike – the ones who open doors and hope to close them before something follows through. The dead who cling to memory are spirits. The fey who trade in stolen time are spirits. The angels that guard thresholds, and the demons that wait hungry at the edge of sin – they are all spirits, and they all speak the language of contract.</p>
<p>The difference between a Summoner who treats with spirits as guests and one who treats them as slaves is the difference between a partnership that lasts decades and a rebellion that ends in blood. The <strong>Leash</strong> is the spiritual strain of keeping an Outsider in the world – a courtesy extended by the spirit while it finds your measure.</p>
<p><em>"I do not command the dead. I ask. I pay the price. And sometimes, when the contract is fair, they answer."</em></p>`},monk:{label:"Monk",icon:"🧘",color:"#f39c12",description:"The body is a temple. The breath is a weapon. Stillness is the greatest disguise.",longDescription:"Monks of the Unbroken Way walk the path of discipline and balance. They do not bargain with Patrons – they master themselves. Their power is not in what they can do, but in what they can choose not to do. The body is a temple; the breath is a weapon; stillness is the greatest disguise.",recommendations:["I want discipline and balance over raw power","I enjoy martial arts and meditation","I want to serve the balance itself"],archetypes:["Martial Artist","Monk","Ascetic","Guardian"],tourDescription:`<p>Monks of the Unbroken Way walk the path of discipline and balance. They do not bargain with Patrons – they master themselves. Their power is not in what they can do, but in what they can choose not to do.</p>
<p>The body is a temple; the breath is a weapon; stillness is the greatest disguise. Monks channel power through breath, through the alignment of spirit and flesh, through the patient accumulation of inner strength. They are feared because they have no obvious weakness – only a discipline that seems to transcend the ordinary limits of mortality.</p>
<p>They serve the balance itself, intervening only when the scales tip too far. They are the quiet guardians, the ones who stand at the edge of the storm and wait for the right moment to act.</p>
<p><em>"I do not pray. I breathe. And in the breathing, the world listens."</em></p>`}},Qt="spellcraft-styles";function Bo(){if(document.getElementById(Qt))return;const e=document.createElement("style");e.id=Qt,e.textContent=`
        .spellcraft-tab {
            position: relative;
            transition: color 0.15s ease, background 0.15s ease, border-color 0.15s ease;
            background: transparent;
            border-color: transparent;
            color: var(--text3);
        }
        .spellcraft-tab:hover {
            color: var(--text);
            background: var(--bg3);
        }
        .spellcraft-tab.active {
            background: var(--gold);
            border-color: var(--gold);
            color: #1a1400;
            font-weight: 600;
        }
        .spellcraft-content-inner {
            animation: spellcraft-fade-in 0.15s ease;
        }
        @keyframes spellcraft-fade-in {
            from { opacity: 0; transform: translateY(2px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .spellcraft-loading {
            padding: 2rem;
            text-align: center;
            color: var(--text3);
            font-size: 0.85rem;
        }
        .spellcraft-path-desc {
            color: var(--text3);
            font-size: 0.7rem;
            max-width: 320px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .spellcraft-patron-pill {
            display: inline-flex;
            align-items: center;
            gap: 0.2rem;
            font-size: 0.75rem;
            padding: 0.05rem 0.5rem;
            border-radius: 10px;
            background: var(--bg3);
            border: 1px solid var(--border);
            color: var(--gold);
        }

        /* ─── Path Finder Cards ──────────────────────────────── */
        .path-finder-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 0.6rem;
        }
        .path-finder-card {
            background: var(--bg2);
            border-radius: var(--radius);
            padding: 0.6rem 0.8rem;
            border: 1px solid var(--border);
            cursor: pointer;
            transition: all 0.15s ease;
            display: flex;
            flex-direction: column;
            gap: 0.2rem;
        }
        .path-finder-card:hover {
            border-color: var(--gold);
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }
        .path-finder-card .path-icon {
            font-size: 1.8rem;
        }
        .path-finder-card .path-label {
            font-weight: 600;
            font-size: 0.95rem;
            color: var(--text);
        }
        .path-finder-card .path-brief {
            font-size: 0.75rem;
            color: var(--text3);
            flex: 1;
        }
        .path-finder-card .path-tags {
            display: flex;
            flex-wrap: wrap;
            gap: 0.2rem;
            margin-top: 0.2rem;
        }
        .path-finder-card .path-tags span {
            font-size: 0.6rem;
            padding: 0.05rem 0.4rem;
            border-radius: 8px;
            background: var(--bg3);
            color: var(--text2);
            border: 1px solid var(--border);
        }
        .path-finder-card .path-rec {
            font-size: 0.65rem;
            color: var(--text3);
            font-style: italic;
            margin-top: 0.2rem;
            border-top: 1px solid var(--border);
            padding-top: 0.2rem;
        }
        .path-finder-card .path-archetypes {
            display: flex;
            flex-wrap: wrap;
            gap: 0.2rem;
            margin-top: 0.1rem;
        }
        .path-finder-card .path-archetypes span {
            font-size: 0.55rem;
            padding: 0.05rem 0.3rem;
            border-radius: 6px;
            background: var(--bg3);
            color: var(--gold);
            border: 1px solid rgba(212, 175, 55, 0.2);
        }
        .path-finder-card .path-choose-btn {
            margin-top: 0.3rem;
            padding: 0.15rem 0.5rem;
            font-size: 0.7rem;
            align-self: flex-start;
            background: var(--gold);
            border: none;
            border-radius: var(--radius);
            color: #1a1400;
            font-weight: 600;
            cursor: pointer;
        }
        .path-finder-card .path-choose-btn:hover {
            background: var(--gold-hover);
        }

        .path-finder-header {
            display: flex;
            flex-direction: column;
            gap: 0.3rem;
            margin-bottom: 0.8rem;
            padding: 0.6rem 0.8rem;
            background: var(--bg2);
            border-radius: var(--radius);
            border-left: 4px solid var(--gold);
        }
        .path-finder-header h2 {
            margin: 0;
            color: var(--gold);
            font-size: 1.1rem;
        }
        .path-finder-header p {
            margin: 0;
            color: var(--text2);
            font-size: 0.85rem;
        }

        /* ─── Path Info Cards (non-interactive reference) ────── */
        .path-info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 0.6rem;
        }
        .path-info-card {
            background: var(--bg2);
            border-radius: var(--radius);
            padding: 0.6rem 0.8rem;
            border: 1px solid var(--border);
            display: flex;
            flex-direction: column;
            gap: 0.2rem;
            text-align: left;
        }

        /* ─── Path dropdown styling ───────────────────────────── */
        .spellcraft-path-select {
            background: var(--bg3);
            color: var(--text);
            border: 1px solid var(--border);
            border-radius: 4px;
            padding: 0.15rem 0.4rem;
            font-size: 0.75rem;
            min-width: 140px;
            cursor: pointer;
        }
        .spellcraft-path-select:hover {
            border-color: var(--gold);
        }
        .spellcraft-path-select option {
            background: var(--bg1);
            color: var(--text);
        }

        /* ─── Magic Paths Tour (inline screen, not a pop-up) ──────── */
        .magic-tour-overlay {
            display: flex; align-items: center; justify-content: center;
            animation: magicTourFadeIn 0.4s ease;
            padding: 1rem 0;
            width: 100%;
        }
        @keyframes magicTourFadeIn {
            from { opacity: 0; transform: scale(0.96); }
            to { opacity: 1; transform: scale(1); }
        }
        .magic-tour-card {
            background: var(--bg1); color: var(--text);
            max-width: 740px; width: 100%; max-height: 90vh;
            padding: 2rem; border-radius: 16px;
            border: 1px solid var(--border);
            box-shadow: 0 20px 60px rgba(0,0,0,0.6);
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 0.8rem;
        }
        .magic-tour-card .tour-header {
            display: flex;
            align-items: center;
            gap: 0.6rem;
            flex-wrap: wrap;
            border-bottom: 1px solid var(--border);
            padding-bottom: 0.4rem;
        }
        .magic-tour-card .tour-header .tour-icon {
            font-size: 2.4rem;
        }
        .magic-tour-card .tour-header .tour-title {
            font-size: 1.6rem;
            font-weight: 700;
            color: var(--text);
        }
        .magic-tour-card .tour-header .tour-count {
            margin-left: auto;
            font-size: 0.8rem;
            color: var(--text3);
            background: var(--bg3);
            padding: 0.1rem 0.6rem;
            border-radius: 12px;
        }
        .magic-tour-card .tour-tagline {
            font-size: 1rem;
            color: var(--text2);
            font-style: italic;
            margin-top: -0.2rem;
        }
        .magic-tour-card .tour-description {
            font-size: 0.95rem;
            line-height: 1.7;
            color: var(--text);
            background: var(--bg2);
            padding: 0.8rem 1rem;
            border-radius: 8px;
            border-left: 3px solid var(--gold);
            max-height: 260px;
            overflow-y: auto;
        }
        .magic-tour-card .tour-description p {
            margin: 0.5rem 0;
        }
        .magic-tour-card .tour-description em {
            color: var(--gold);
        }
        .magic-tour-card .tour-meta {
            display: flex;
            flex-wrap: wrap;
            gap: 0.4rem;
            align-items: center;
            font-size: 0.8rem;
        }
        .magic-tour-card .tour-meta .tour-archetypes {
            display: flex;
            flex-wrap: wrap;
            gap: 0.3rem;
        }
        .magic-tour-card .tour-meta .tour-archetypes span {
            background: var(--bg3);
            padding: 0.05rem 0.5rem;
            border-radius: 10px;
            border: 1px solid var(--border);
            font-size: 0.7rem;
            color: var(--text2);
        }
        .magic-tour-card .tour-meta .tour-rec {
            font-size: 0.75rem;
            color: var(--text3);
            font-style: italic;
            margin-top: 0.1rem;
            flex-basis: 100%;
        }
        .magic-tour-card .tour-nav {
            display: flex;
            gap: 0.6rem;
            flex-wrap: wrap;
            align-items: center;
            border-top: 1px solid var(--border);
            padding-top: 0.6rem;
            margin-top: 0.2rem;
        }
        .magic-tour-card .tour-nav .btn {
            padding: 0.4rem 1rem;
            font-size: 0.85rem;
        }
        .magic-tour-card .tour-nav .tour-choose {
            background: var(--gold);
            color: #1a1400;
            font-weight: 700;
            border: none;
            border-radius: var(--radius);
            cursor: pointer;
        }
        .magic-tour-card .tour-nav .tour-choose:hover {
            background: var(--gold-hover);
        }
        .magic-tour-card .tour-nav .tour-skip {
            color: var(--text3);
            background: transparent;
            border: none;
            font-size: 0.8rem;
            cursor: pointer;
            text-decoration: underline;
        }
        .magic-tour-card .tour-nav .tour-skip:hover {
            color: var(--text);
        }
    `,document.head.appendChild(e)}var F=null,we=[],U="spellbook",Jt=0,wt=!1,Qe=!1,ce=0,Zt=["free-caster","runekeeper","invoker","cantor","witch","psion","summoner","monk"];function v(e={}){const{silent:t=!1}=e,r=_e.getSelectedCharacterId();if(!r)return t||l("Select a character first.","error"),null;const n=Dr(r);return n||(t||l("Character not found.","error"),null)}function k(e){const t=_e.getSelectedCharacterId();return t&&et(t,e)?(dt(),!0):!1}function Qo(e){return[]}function Lo(e){return e?e.magicPath==="invoker"?(e.symbols||[]).map(t=>typeof t=="string"?t:t?.patronId||t?.patron||t?.id).filter(Boolean):e.patron?[e.patron]:[]:[]}function Fr(e){return Object.entries(te).map(([t,r])=>`<option value="${t}" ${t===e?"selected":""}>${r.icon} ${r.label}</option>`).join("")}function Eo(){return E().app?.magicTourSeen||!1}function xe(e=!0){const t=E();t.app||(t.app={}),t.app.magicTourSeen=e,He()}function Nt(){if(Qe)return;const e=v({silent:!0});if(!e){l("Select a character to explore magic paths.","info");return}Qe=!0,ce=0,xt(e)}var Ie=null;function Be(){Qe=!1;const e=document.getElementById("magic-tour-overlay");e&&e.remove(),Ie&&(Ie.forEach(t=>{t.style.display=""}),Ie=null),F&&Me(F)}function xt(e){let t=document.getElementById("magic-tour-overlay");if(!t){t=document.createElement("div"),t.id="magic-tour-overlay",t.className="magic-tour-overlay";const a=document.getElementById("app-content")||document.body;Ie=Array.from(a.children),Ie.forEach(s=>{s.style.display="none"}),a.appendChild(t),window.scrollTo({top:0})}const r=Zt[ce],n=te[r];if(!n){Be();return}const o=Zt.length,i=e.magicPath||"none";t.innerHTML=`
        <div class="magic-tour-card">
            <div class="tour-header">
                <span class="tour-icon">${n.icon}</span>
                <span class="tour-title" style="color:${n.color};">${n.label}</span>
                <span class="tour-count">${ce+1} / ${o}</span>
            </div>
            <div class="tour-tagline">${n.description}</div>
            <div class="tour-description">${n.tourDescription||n.longDescription||n.description}</div>
            <div class="tour-meta">
                ${n.archetypes&&n.archetypes.length?`
                    <div class="tour-archetypes">
                        <strong style="font-size:0.7rem;color:var(--text3);">Archetypes:</strong>
                        ${n.archetypes.map(a=>`<span>${p(a)}</span>`).join("")}
                    </div>
                `:""}
                ${n.recommendations&&n.recommendations.length?`
                    <div class="tour-rec">
                        <strong>You might like this if:</strong>
                        ${n.recommendations.map(a=>`<div style="padding-left:0.5rem;">• ${p(a)}</div>`).join("")}
                    </div>
                `:""}
            </div>
            <div class="tour-nav">
                <button class="btn btn-secondary" id="tour-prev" ${ce===0?"disabled":""}>← Previous</button>
                <button class="btn tour-choose" id="tour-choose">✨ Choose This Path</button>
                <button class="btn btn-secondary" id="tour-next">${ce===o-1?"Finish Tour →":"Next →"}</button>
                <button class="tour-skip" id="tour-skip">Skip Tour</button>
            </div>
        </div>
    `,t.querySelector("#tour-prev")?.addEventListener("click",()=>{ce>0&&(ce--,xt(e))}),t.querySelector("#tour-next")?.addEventListener("click",()=>{ce<o-1?(ce++,xt(e)):(xe(!0),Be())}),t.querySelector("#tour-choose")?.addEventListener("click",()=>{if(r===i){l(`Already on the ${n.label} path.`,"info"),xe(!0),Be();return}et(e.id,{magicPath:r})?(l(`✨ Chosen: ${n.label}`,"success"),xe(!0),Be(),F&&Me(F)):l("Failed to update character.","error")}),t.querySelector("#tour-skip")?.addEventListener("click",()=>{xe(!0),Be()})}function jr(){const e=v({silent:!0});e&&!Eo()&&(e.magicPath==="none"||!e.magicPath)&&setTimeout(()=>Nt(),400)}function Io(){const e=E().characters||[];return`
        <div class="spellcraft-empty" style="padding:1.5rem 1.5rem 2rem;text-align:center;color:var(--text3);background:var(--bg2);border-radius:var(--radius);border:1px dashed var(--border);">
            <div style="font-size:3rem;">🧙</div>
            <h2 style="margin:0.5rem 0;color:var(--text);">Select a Character</h2>
            <p style="margin:0 0 0.8rem;">Pick a character below, or go to the VTT and click a character card.</p>

            <div style="display:flex;gap:0.4rem;justify-content:center;align-items:center;flex-wrap:wrap;margin-bottom:1rem;">
                ${e.length>0?`
                    <select id="spellcraft-char-select" style="background:var(--bg3);color:var(--text);border:1px solid var(--border);border-radius:var(--radius);padding:0.35rem 0.6rem;font-size:0.85rem;min-width:220px;">
                        <option value="">— Choose a character —</option>
                        ${e.map(t=>{const r=t.magicPath&&t.magicPath!=="none"?te[t.magicPath]?.label||t.magicPath:null;return`<option value="${p(t.id)}">${p(t.name||"Unnamed")}${r?` — ${p(r)}`:""}</option>`}).join("")}
                    </select>
                `:`
                    <p style="font-size:0.85rem;color:var(--text3);margin:0;">No characters yet — create one on the Characters tab first.</p>
                `}
                <button class="btn btn-gold" id="go-to-vtt-btn">🎯 Go to VTT</button>
            </div>

            <div style="text-align:left;max-width:960px;margin:0 auto;">
                <div style="font-weight:600;color:var(--gold);margin-bottom:0.5rem;text-align:center;">📚 Magic Paths at a Glance</div>
                <div class="path-info-grid">
                    ${Object.entries(te).filter(([t])=>t!=="none").map(([t,r])=>`
                            <div class="path-info-card">
                                <div style="display:flex;align-items:center;gap:0.3rem;">
                                    <span class="path-icon">${p(r.icon)}</span>
                                    <span class="path-label" style="color:${r.color};">${p(r.label)}</span>
                                </div>
                                <div class="path-brief">${p(r.description)}</div>
                                ${r.archetypes?`
                                    <div class="path-archetypes">
                                        ${r.archetypes.map(n=>`<span>${p(n)}</span>`).join("")}
                                    </div>
                                `:""}
                            </div>
                        `).join("")}
                </div>
                <div style="margin-top:0.6rem;font-size:0.75rem;color:var(--text3);text-align:center;">
                    The Spellbook is available to every character regardless of path. Witchcraft (Hedge Gifts, Quick Workings, Full Rituals) also works without the Witch path if you've taken "Craft of the Hedge." Ingredient/recipe crafting and the item Codex live in their own <strong>Crafting</strong> page in the sidebar.
                </div>
            </div>
        </div>
    `}function Fo(){const e=document.getElementById("spellcraft-char-select");e&&e.addEventListener("change",()=>{const t=e.value;t&&(_e.updateCharacters(E().characters||[]),_e.selectCharacter(t))})}function Me(e){if(F=e,!F)return;Bo();const t=v({silent:!0});if(!t){F.innerHTML=Io(),qe(),Fo();return}const r=t.magicPath||"none",n=te[r]||te.none,o=t.patron||null,i=t.name||"Unnamed Character";if(r==="none"){wt=!0,U="spellbook",jo(t,i,n,o),qe(),jr();return}wt=!1;const a=Ze(t);a.some(c=>c.id===U)||(U="spellbook");const s=Fr(r);F.innerHTML=`
        <div class="spellcraft-container" style="display:flex;flex-direction:column;gap:0.8rem;">

            <!-- ─── Header ─────────────────────────────────────── -->
            <header class="spellcraft-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;border-bottom:2px solid var(--border);padding-bottom:0.5rem;">
                <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;">
                    <span style="font-size:1.8rem;">${p(n.icon)}</span>
                    <div>
                        <h1 class="page-title" style="margin:0;font-size:1.2rem;">${p(i)}</h1>
                        <div style="display:flex;align-items:center;gap:0.4rem;flex-wrap:wrap;font-size:0.8rem;color:var(--text2);">
                            <span style="font-weight:600;color:${n.color};">${p(n.label)}</span>
                            ${o?`<span class="spellcraft-patron-pill">🔮 ${p(o)}</span>`:""}
                            <span class="spellcraft-path-desc" title="${p(n.description)}">${p(n.description)}</span>
                        </div>
                    </div>
                </div>
                <div style="display:flex;gap:0.3rem;flex-wrap:wrap;align-items:center;">
                    <select id="spellcraft-path-select" class="spellcraft-path-select" title="Change magic path">
                        ${s}
                    </select>
                    <button class="btn btn-sm btn-secondary" id="spellcraft-set-path" title="Set magic path">Set Path</button>
                    <button class="btn btn-sm btn-ghost" id="spellcraft-refresh" title="Refresh">↻</button>
                    <button class="btn btn-sm btn-secondary" id="show-magic-tour-btn" title="Magic Paths Tour">🎭 Tour</button>
                </div>
            </header>

            <!-- ─── Tracks ─────────────────────────────────────── -->
            <div id="trackers-container" class="panel" style="padding:0.3rem 0.5rem;background:var(--bg2);border-radius:var(--radius);"></div>

            <!-- ─── Tabs ────────────────────────────────────────── -->
            <div class="spellcraft-tabs" style="display:flex;gap:0.2rem;border-bottom:1px solid var(--border);padding-bottom:0.1rem;flex-wrap:wrap;">
                ${Je(a)}
            </div>

            <!-- ─── Tab Content ────────────────────────────────── -->
            <div id="spellcraft-content" class="spellcraft-content" style="min-height:300px;">
                <div class="spellcraft-loading">Loading…</div>
            </div>

            <!-- ─── Footer ────────────────────────────────────── -->
            <div class="spellcraft-footer" style="display:grid;grid-template-columns:2fr 1fr;gap:0.5rem;border-top:1px solid var(--border);padding-top:0.5rem;font-size:0.7rem;color:var(--text3);">
                <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
                    <span>📖 <strong>Path:</strong> ${p(n.label)}</span>
                    ${o?`<span>🔮 <strong>Patron:</strong> ${p(o)}</span>`:""}
                    <span>📊 <strong>Tracks:</strong> ${p(No(t))}</span>
                </div>
                <div style="text-align:right;font-style:italic;">
                    "The Weave remembers." – Lysandra
                </div>
            </div>

        </div>
    `,dt(),qe()}function jo(e,t,r,n){const o=Fr("none");F.innerHTML=`
        <div class="spellcraft-container" style="display:flex;flex-direction:column;gap:0.8rem;">

            <!-- ─── Header ─────────────────────────────────────── -->
            <header class="spellcraft-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;border-bottom:2px solid var(--border);padding-bottom:0.5rem;">
                <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;">
                    <span style="font-size:1.8rem;">${p(r.icon)}</span>
                    <div>
                        <h1 class="page-title" style="margin:0;font-size:1.2rem;">${p(t)}</h1>
                        <div style="display:flex;align-items:center;gap:0.4rem;flex-wrap:wrap;font-size:0.8rem;color:var(--text2);">
                            <span style="font-weight:600;color:var(--text3);">${p(r.label)}</span>
                            ${n?`<span class="spellcraft-patron-pill">🔮 ${p(n)}</span>`:""}
                            <span class="spellcraft-path-desc" title="${p(r.description)}">${p(r.description)}</span>
                        </div>
                    </div>
                </div>
                <div style="display:flex;gap:0.3rem;flex-wrap:wrap;align-items:center;">
                    <select id="spellcraft-path-select" class="spellcraft-path-select" title="Change magic path">
                        ${o}
                    </select>
                    <button class="btn btn-sm btn-secondary" id="spellcraft-set-path" title="Set magic path">Set Path</button>
                    <button class="btn btn-sm btn-ghost" id="spellcraft-refresh" title="Refresh">↻</button>
                    <button class="btn btn-sm btn-secondary" id="show-magic-tour-btn" title="Magic Paths Tour">🎭 Tour</button>
                </div>
            </header>

            <!-- ─── Path Finder Body ───────────────────────────── -->
            <div class="path-finder-body" style="display:flex;flex-direction:column;gap:0.8rem;">

                <div class="path-finder-header">
                    <h2>🧙 Choose Your Magical Path</h2>
                    <p>
                        Your path defines how you interact with the Weave – and what it costs you.
                        Each path offers a different experience, from the structured covenants of the
                        Runekeeper to the raw will of the Psion.
                    </p>
                    <p style="font-size:0.8rem;color:var(--text3);">
                        <strong>💡 Tip:</strong> The Crafting page (sidebar) works regardless of your path, and
                        "Craft of the Hedge" unlocks Witchcraft's Hedge Gifts without committing to the Witch path.
                        Choose the path that feels right for your character's story.
                    </p>
                </div>

                <div class="path-finder-grid">
                    ${Object.entries(te).filter(([a])=>a!=="none").map(([a,s])=>{const c=a===(e.magicPath||"none");return`
                                <div class="path-finder-card" style="${c?"border-color:var(--gold);background:var(--bg3);":""}" data-path="${a}">
                                    <div style="display:flex;align-items:center;gap:0.3rem;">
                                        <span class="path-icon">${p(s.icon)}</span>
                                        <span class="path-label" style="color:${s.color};">${p(s.label)}</span>
                                        ${c?'<span style="font-size:0.6rem;color:var(--gold);">✓ Active</span>':""}
                                    </div>
                                    <div class="path-brief">${p(s.description)}</div>
                                    ${s.archetypes?`
                                        <div class="path-archetypes">
                                            ${s.archetypes.map(d=>`<span>${p(d)}</span>`).join("")}
                                        </div>
                                    `:""}
                                    ${s.recommendations&&s.recommendations.length>0?`
                                        <div class="path-rec">
                                            <strong>You might like this if:</strong>
                                            ${s.recommendations.slice(0,2).map(d=>`<div style="padding-left:0.5rem;">• ${p(d)}</div>`).join("")}
                                        </div>
                                    `:""}
                                    <button class="path-choose-btn" data-path="${a}">${c?"✓ Selected":"Choose This Path"}</button>
                                </div>
                            `}).join("")}
                </div>

                <div style="padding:0.5rem;background:var(--bg2);border-radius:var(--radius);border-left:4px solid var(--gold);font-size:0.8rem;color:var(--text3);">
                    <strong>💡 Not sure?</strong> Take the <button class="btn btn-sm btn-secondary" id="show-magic-tour-btn-inline" style="font-size:0.7rem;padding:0.05rem 0.5rem;">🎭 Magic Paths Tour</button> to explore each tradition in depth.
                </div>

                <!-- ─── Tracks (minimal) ──────────────────────────── -->
                <div id="trackers-container" class="panel" style="padding:0.3rem 0.5rem;background:var(--bg2);border-radius:var(--radius);">
                    <div style="font-size:0.7rem;color:var(--text3);">No active tracks. Choose a path to begin.</div>
                </div>

                <!-- ─── Tabs (Spellbook, + Witchcraft if hedge-gifted) ─────────── -->
                <div class="spellcraft-tabs" style="display:flex;gap:0.2rem;border-bottom:1px solid var(--border);padding-bottom:0.1rem;flex-wrap:wrap;">
                    ${Je(Ze(e))}
                </div>

                <div id="spellcraft-content" class="spellcraft-content" style="min-height:200px;">
                    <div class="spellcraft-loading">Loading…</div>
                </div>

            </div>

            <!-- ─── Footer ──────────────────────────────────────── -->
            <div class="spellcraft-footer" style="display:grid;grid-template-columns:2fr 1fr;gap:0.5rem;border-top:1px solid var(--border);padding-top:0.5rem;font-size:0.7rem;color:var(--text3);">
                <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
                    <span>📖 <strong>Path:</strong> ${p(r.label)}</span>
                    ${n?`<span>🔮 <strong>Patron:</strong> ${p(n)}</span>`:""}
                    <span>📊 <strong>Status:</strong> Choose a path to unlock full features</span>
                </div>
                <div style="text-align:right;font-style:italic;">
                    "The Weave remembers." – Lysandra
                </div>
            </div>

        </div>
    `,dt(),qe(),F.querySelectorAll(".path-choose-btn").forEach(a=>{a.addEventListener("click",s=>{s.stopPropagation();const c=a.dataset.path;c&&er(c)})}),F.querySelectorAll(".path-finder-card").forEach(a=>{a.addEventListener("click",s=>{if(s.target.closest(".path-choose-btn"))return;const c=a.dataset.path;c&&er(c)})});const i=F.querySelector("#show-magic-tour-btn-inline");i&&i.addEventListener("click",()=>Nt()),jr()}function er(e){const t=v();if(t){if(e===t.magicPath){l(`Already on the ${te[e]?.label||e} path.`,"info");return}et(t.id,{magicPath:e})?(l(`✨ Path changed to ${te[e]?.label||e}`,"success"),xe(!0),Me(F)):l("Failed to change path.","error")}}function Je(e){return e.map(t=>`
        <button class="spellcraft-tab btn btn-sm${U===t.id?" active":""}" data-tab="${t.id}">
            ${t.icon} ${t.label}
        </button>
    `).join("")}function Ho(e){const t=(e.talents||[]).some(r=>r.name==="Craft of the Hedge"||r.id==="craft-of-the-hedge");return e.magicPath==="witch"||t||(e.hedgeGifts||[]).length>0||(e.witch?.hedgeGifts||[]).length>0}function Ze(e){const t=e.magicPath||"none",r=[];return r.push({id:"spellbook",label:"Spellbook",icon:"📚"}),Ho(e)&&r.push({id:"witchcraft",label:"Witchcraft",icon:"🧹"}),t==="none"||(t==="free-caster"&&r.push({id:"calculator",label:"Calculator",icon:"🔮"}),(t==="runekeeper"||t==="invoker")&&r.push({id:"rites",label:"Rites",icon:"📜"}),t==="cantor"&&r.push({id:"cantor",label:"Cantor",icon:"🎵"}),t==="psion"&&r.push({id:"psionics",label:"Psionics",icon:"🧠"}),t==="summoner"&&r.push({id:"summoning",label:"Summoning",icon:"👁️"}),(t==="monk"||e.monasticTradition)&&r.push({id:"monks",label:"Monks",icon:"🧘"})),r}async function $t(){const e=document.getElementById("spellcraft-content");if(!e)return;const t=v();if(!t)return;const r=++Jt;e.innerHTML='<div class="spellcraft-loading">Loading…</div>';const n=document.createElement("div");n.className="spellcraft-content-inner";try{switch(U){case"spellbook":D(n);break;case"calculator":await ur(n);break;case"rites":{const o=Lo(t);await _r(n,o,t.id,{path:t.magicPath==="invoker"?"invoker":"runekeeper",characterName:t.name});break}case"cantor":await Br(n);break;case"psionics":await Ir(n);break;case"summoning":await re(n);break;case"monks":se(n);break;case"witchcraft":$r(n,{fullMode:!0});break;default:n.innerHTML='<p style="color:var(--text3);">Select a tab to view its content.</p>'}}catch(o){console.error(`Spellcraft: error rendering tab "${U}":`,o),n.innerHTML='<p style="color:var(--red);">Failed to load this tab. Check the console for details.</p>'}r===Jt&&(e.innerHTML="",e.appendChild(n))}function dt(){const e=v();if(!e)return;if(wt){const o=document.getElementById("trackers-container");o&&(o.innerHTML='<div style="font-size:0.7rem;color:var(--text3);">No active tracks. Choose a path to begin.</div>');const i=Ze(e),a=document.querySelector(".spellcraft-tabs");a&&(a.innerHTML=Je(i)),$t();return}const t=document.getElementById("trackers-container");t&&Pn(t);const r=Ze(e);r.some(o=>o.id===U)||(U="spellbook");const n=document.querySelector(".spellcraft-tabs");n&&(n.innerHTML=Je(r)),$t()}function Do(e){if(e===U)return;U=e;const t=document.querySelector(".spellcraft-tabs");t&&t.querySelectorAll(".spellcraft-tab").forEach(r=>{r.classList.toggle("active",r.dataset.tab===U)}),$t()}function No(e){const t=e.magicPath||"none",r=[];if(t==="none")return"No path selected – choose one above to begin";if(t==="runekeeper"||t==="invoker"){const n=e.obligation||0,o=(e.spirit||1)+(e.presence||1);r.push(`Obligation ${n}/${o}`)}if(t==="cantor"){const n=e.corruption||0,o=e.corruptionMax||e.spirit||1;r.push(`Corruption ${n}/${o}`)}if(t==="summoner"){const n=e.leash||0,o=e.leashMax||4,i=(e.boundSpirits||[]).length;r.push(`Leash ${n}/${o} · ${i} spirits`)}if(t==="psion"){const n=e.mentalStrain||0,o=e.mentalStrainMax||e.spirit||1;r.push(`Mental Strain ${n}/${o}`)}if(t==="witch"){const n=e.witch?.prices?.shadow||0,o=e.witch?.prices?.shame||0,i=e.witch?.prices?.identityStrain||0;r.push(`Shadow ${n} · Shame ${o} · Identity ${i}`)}if(t==="monk"||e.monasticTradition){const n=e.breathState||"entering",o=e.monkCorruptionTier||0;r.push(`Breath: ${n} · Corruption Tier ${o}`)}return r.join(" · ")||"No active tracks"}function qe(){we.forEach(({target:r,event:n,handler:o})=>{(r||F)?.removeEventListener(n,o)}),we=[];const e=r=>{const n=r.target.closest(".spellcraft-tab");if(n){Do(n.dataset.tab);return}const o=r.target.closest("button, [id]");if(o)switch(o.id){case"go-to-vtt-btn":window.location.hash="vtt";break;case"spellcraft-refresh":dt(),l("🔄 Refreshed","info");break;case"spellcraft-set-path":tr();break;case"show-magic-tour-btn":Nt()}};if(F&&(F.addEventListener("click",e),we.push({target:F,event:"click",handler:e})),document.getElementById("spellcraft-set-path")){const r=document.getElementById("spellcraft-path-select");r&&r.addEventListener("keydown",n=>{n.key==="Enter"&&tr()})}const t=()=>{F&&Me(F)};document.addEventListener("characterSelected",t),we.push({target:document,event:"characterSelected",handler:t})}function tr(){const e=document.getElementById("spellcraft-path-select");if(!e)return;const t=e.value;if(!t)return;const r=v();if(r){if(t===r.magicPath){l(`Already on the ${te[t]?.label||t} path.`,"info");return}et(r.id,{magicPath:t})?(U="spellbook",xe(!0),l(`⚙️ Magic path changed to ${te[t]?.label||t}`,"success"),Me(F)):l("Failed to update character.","error")}}function Oo(){F&&(we.forEach(({event:t,handler:r})=>{F.removeEventListener(t,r)}),we=[],F.innerHTML="",F=null);const e=document.getElementById("magic-tour-overlay");e&&e.remove(),Qe=!1}var Jo={render:Me,destroy:Oo};export{Jo as default,Oo as destroy,Oo as destroySpellcraft,v as getCharacterData,Qo as getPatronRites,Me as render,Me as renderSpellcraft,k as saveCharacter,Nt as showMagicTour};
