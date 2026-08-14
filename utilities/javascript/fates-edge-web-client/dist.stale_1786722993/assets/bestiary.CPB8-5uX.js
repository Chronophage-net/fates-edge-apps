import{t as Ye}from"./rolldown-runtime.BQ-_32WO.js";import{i as g}from"./utils.lBShoim5.js";import{D as Me,b as S}from"./state.42sFgcOQ.js";import{n as m}from"./Toast.DDAtBIAw.js";import{C as Ae,p as le}from"./websocket.Dmklt06W.js";import{h as Ue,m as Ve}from"./main.hiOZSyFC.js";import{i as ee,o as de,t as Je}from"./objective-types.CuiNbA6A.js";import{r as ze,t as je}from"./gm-tools.BcndmVEn.js";import{t as Ke}from"./discovery.I-q7Uafb.js";var Ft=Ye({default:()=>kt,getLiveCombatants:()=>ht,getRangeBandBetween:()=>$t,getRangeBandInfo:()=>pe,getTrackerState:()=>xt,isTrackerOpen:()=>yt,openTracker:()=>_e,setTrackerRangeByName:()=>wt});function K(){return!le()||Ue(Ve())}var l=null,N=null,B=null,s=[],A=0,$=0,h=0,k=6,_="Combat Timer",j=[],L=null,T={},G=!1,W=Je,q="",P="",Ie="fates-edge-gm-sb-bank",w=0;function Xe(){try{const e=localStorage.getItem(Ie);w=e?Math.max(0,parseInt(e,10)):0}catch{w=0}}function ce(){try{localStorage.setItem(Ie,String(w))}catch{}}function Le(e){w=Math.max(0,w+e),ce();const t=document.getElementById("sb-bank-input");t&&(t.value=w)}function Qe(e,t){if(w<e)return m(`Need ${e} SB; only ${w} available.`,"warning"),!1;w-=e,ce();const r=document.getElementById("sb-bank-input");r&&(r.value=w);try{ze(`💥 SB spent (${e}): ${t}`,"danger"),je("sb_spent",{cost:e,label:t})}catch{}return m(`Spent ${e} SB — ${t}`,"success"),!0}var Ze=[{cost:1,name:"Minor complication",effect:"Tick a timer +1, leave a trace, make a noise, or introduce a small distraction."},{cost:2,name:"Moderate complication",effect:"Alarm raised, worsen Position, lesser foe appears, or damage an asset."},{cost:3,name:"Major complication",effect:"Reinforcements arrive, the scene shifts, an asset breaks, or a bond is tested."}];function Se(e,t){const r=parseInt(e.cost,10)||1;return`
        <div class="sb-move-card" style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:0.45rem 0.6rem;font-size:0.78rem;">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:0.4rem;">
                <strong style="color:var(--text);">${g(e.name)}</strong>
                <button class="btn btn-xs btn-danger sb-spend-btn" data-cost="${r}" data-label="${I(t||e.name)}" style="font-size:0.65rem;">
                    ${r} SB
                </button>
            </div>
            ${e.source?`<div style="font-size:0.65rem;color:var(--text3);margin:0.1rem 0;">${g(e.source)}</div>`:""}
            <div style="color:var(--text2);margin-top:0.15rem;">${g(e.effect)}</div>
        </div>
    `}function I(e){return g(String(e??"")).replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function Be(e){return Math.max(1,(parseInt(e,10)||2)+2)}var F=[{key:"close",label:"Close",short:"C",color:"var(--red)",desc:"Knife/grapple distance — well within arm's reach."},{key:"near",label:"Medium",short:"M",color:"var(--gold)",desc:"Striking distance of a one-handed weapon."},{key:"reach",label:"Reach",short:"R",color:"var(--orange)",desc:"Striking distance of a two-handed weapon — the gap a Reach-tagged weapon (spear, polearm) can still close."},{key:"far",label:"Far",short:"F",color:"var(--blue)",desc:"Beyond melee range — missile-weapon distance."},{key:"absent",label:"Absent",short:"A",color:"var(--text3)",desc:"Beyond missile range — functionally gone; requires a scene change."}],me="near";function et(e,t){switch((typeof e!="number"||e<0)&&(e=0),(t||"none").toLowerCase()){case"light":return{harm:Math.max(0,e-1),fatigue:Math.min(e,1)};case"medium":return{harm:Math.max(0,e-2),fatigue:Math.min(Math.ceil(e/2),1)};case"heavy":return{harm:Math.max(0,e-3),fatigue:Math.min(Math.ceil(e/2),2)};default:return{harm:e,fatigue:0}}}var tt={light:{close:2,near:1,reach:-3,far:-3,absent:-3},medium:{close:1,near:2,reach:-3,far:-3,absent:-3},heavy:{close:-1,near:3,reach:0,far:-3,absent:-3},ranged:{close:-2,near:2,reach:2,far:1,absent:-3}},Re={light:"🗡️",medium:"⚔️",heavy:"🔨",ranged:"🏹"},X={light:"Light",medium:"Medium",heavy:"Heavy",ranged:"Ranged"};function Q(e){if(e){if(X[e.weaponClass])return e.weaponClass;if(e.weaponType==="ranged")return"ranged";if(e.weaponType==="melee")return e.reach?"heavy":"medium"}}function se(e,t){const r=e.weaponClass,o=tt[r];if(!o||o[t]===void 0)return"ok";const n=o[t];return n<=-3?"blocked":n<0?"penalty":"ok"}function Z(e){const t=e.weaponClass;return X[t]?`${Re[t]} ${X[t]}`:"❔ Weapon not set"}function at(e){const t=e.weaponClass;return Re[t]||"❔"}function ie(e,t,r){return e==="blocked"?`${Z(t)} can't attack at ${r} range`:e==="penalty"?`${Z(t)} attacks at a penalty at ${r} range`:""}function te(e,t){return[e,t].sort().join("::")}function ae(e,t){return e===t?null:T[te(e,t)]||me}function He(e,t,r){e!==t&&(T[te(e,t)]=r)}function Ce(e,t){const r=ae(e,t),o=F.findIndex(i=>i.key===r),n=F[(o+1)%F.length];He(e,t,n.key)}function pe(e){return F.find(t=>t.key===e)||F[1]}function re(e){s.forEach(t=>{if(t.id===e.id||t.type===e.type)return;const r=te(e.id,t.id);r in T||(T[r]=me)})}function rt(){for(let e=0;e<s.length;e++)for(let t=e+1;t<s.length;t++){const r=s[e],o=s[t];if(r.type===o.type)continue;const n=te(r.id,o.id);n in T||(T[n]=me)}}function nt(e){Object.keys(T).forEach(t=>{t.split("::").includes(e)&&delete T[t]})}function ot(){const e=s.filter(i=>i.type==="player"),t=s.filter(i=>i.type==="adversary"),r=!K();let o;e.length===0||t.length===0?o=`
            <div style="color:var(--text3);padding:1rem;text-align:center;font-size:0.85rem;">
                Add at least one 👤 Player and one 👾 Adversary to track ranges between them.
            </div>`:o=`
            <div style="overflow-x:auto;">
                <table style="border-collapse:collapse;width:100%;">
                    <thead><tr><th></th>${t.map(i=>`
            <th style="padding:0.4rem 0.5rem;font-size:0.75rem;color:var(--text2);font-weight:600;white-space:nowrap;">
                ${g(i.name)}
            </th>`).join("")}</tr></thead>
                    <tbody>${e.map(i=>{const u=t.map(a=>{const d=ae(i.id,a.id),p=pe(d),b=se(i,d),y=se(a,d),c=b==="blocked"||y==="blocked"?"blocked":b==="penalty"||y==="penalty"?"penalty":"ok",x=[ie(b,i,p.label),ie(y,a,p.label)].filter(Boolean).join("; "),E=c==="blocked"?"🚫 ":c==="penalty"?"⚠️ ":"",C=c==="blocked"?"2px dashed var(--red)":c==="penalty"?"2px dashed var(--orange)":"none",U=`${g(i.name)} ↔ ${g(a.name)}: ${p.label} — ${p.desc}`+(r?" (only the GM can change ranges)":" (click to cycle)")+(x?` — ${g(x)}`:"");return`
                    <td style="padding:0.3rem 0.4rem;text-align:center;">
                        <button class="range-cell" data-a="${I(i.id)}" data-b="${I(a.id)}" ${r?"disabled":""}
                            title="${U}"
                            style="
                                min-width:64px; font-size:0.75rem; font-weight:700; color:white;
                                background:${p.color}; border:${C}; border-radius:8px;
                                padding:0.3rem 0.5rem; transition:transform 0.15s ease;
                                ${r?"cursor:default;opacity:0.7;":"cursor:pointer;"}
                            ">${r?"🔒 ":""}${E}${p.label}</button>
                    </td>`}).join("");return`
                <tr>
                    <th style="padding:0.4rem 0.6rem;text-align:right;font-size:0.8rem;color:var(--text);white-space:nowrap;">
                        ${g(i.name)}
                    </th>
                    ${u}
                </tr>`}).join("")}</tbody>
                </table>
            </div>`;const n=F.map(i=>`
        <span style="display:inline-flex;align-items:center;gap:0.3rem;font-size:0.7rem;color:var(--text2);margin-right:0.9rem;">
            <span style="width:10px;height:10px;border-radius:3px;background:${i.color};display:inline-block;"></span>
            <strong style="color:var(--text);">${i.label}</strong> — ${i.desc}
        </span>`).join("");return`
        <div style="
            background: var(--bg3); border-radius: 12px; padding: 0.9rem 1rem;
            margin-bottom: 1.25rem; border: 1px solid var(--border);
        ">
            <div style="font-size:0.7rem;color:var(--text3);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.6rem;">
                📏 Range Grid — ${r?"GM sets ranges; players see them read-only":"click any cell to cycle"} Close → Medium → Reach → Far → Absent
            </div>
            ${o}
            <div style="margin-top:0.7rem;padding-top:0.6rem;border-top:1px solid var(--border);">
                ${n}
            </div>
            <div style="margin-top:0.5rem;font-size:0.7rem;color:var(--text2);">
                🚫 = a combatant's weapon can't act at that range · ⚠️ = attacks there at a penalty ·
                click a combatant's ${g("⚔️/🏹")} chip in the list to change their weapon.
            </div>
        </div>`}function ue(e){const t=S();return t.factions?(t.factions.factions||[]).find(r=>r.name.toLowerCase().includes(e.toLowerCase())||e.toLowerCase().includes(r.name.toLowerCase())):null}function be(e){const t=S();return t.patrons?(t.patrons.cosmic||[]).find(r=>r.name.toLowerCase().includes(e.toLowerCase())||e.toLowerCase().includes(r.name.toLowerCase())):null}function ge(e){const t=S();return t.factions?(t.factions.followers||[]).find(r=>r.name.toLowerCase().includes(e.toLowerCase())||e.toLowerCase().includes(r.name.toLowerCase())):null}function fe(e){const t=S();return t.factions?(t.factions.assets||[]).find(r=>r.name.toLowerCase().includes(e.toLowerCase())||e.toLowerCase().includes(r.name.toLowerCase())):null}function ve(e){const t=S();return t.rivals?(t.rivals||[]).find(r=>r.name?.toLowerCase().includes(e.toLowerCase())||e.toLowerCase().includes(r.name?.toLowerCase()||"")):null}async function _e(e){const t=S().encounters?.find(n=>String(n.id)===String(e));if(!t){m("Encounter not found.","error");return}B=e;const r=await Pe(),o=t.type||"combat";W=o,q=t.customLabel||"",P=t.customTickLabel||"",s=(t.adversaries||[]).map(n=>{const i=r.find(x=>(x.name||"").toLowerCase()===(n.name||"").toLowerCase()),u=n.tl!==void 0?n.tl:i?.tl!==void 0?i.tl:2,a=n.class||i?.class||"",d=n.category||i?.category||"",p=n.sb_spends?.length?n.sb_spends:i?.sb_spends||[],b=n.body||(i?z(i):""),y=n.stats||i?.stats||{},c=Q(n)||Q(i);return{id:"combat-"+Date.now()+"-"+Math.random().toString(36).substr(2,9),name:n.name||"Adversary",initiative:Math.floor(Math.random()*20)+1,harm:0,fatigue:0,armorType:n.armorType||"none",weaponClass:c,maxHarm:Be(u),status:"active",notes:b||"",type:"adversary",objectiveType:n.objectiveType||o,customLabel:n.customLabel||q,customTickLabel:n.customTickLabel||P,maxMeansSuccess:n.maxMeansSuccess!==void 0?n.maxMeansSuccess:void 0,tl:u,class:a,category:d,sbSpends:p,stats:y,linkedFaction:ue(n.name),linkedPatron:be(n.name),linkedFollower:ge(n.name),linkedAsset:fe(n.name),linkedRival:ve(n.name)}}),A=0,$=0,h=0,k=6,_="Combat Timer",j=[],T={},G=!1,rt(),f()}function st(){if(!le()||!s.length)return;const e=s[$]||null,t=(S().encounters||[]).find(r=>String(r.id)===String(B));try{Ae({type:"combat-status-update",combat:{encounterId:B,encounterTitle:t?t.title:null,round:A,activeName:e?e.name:null,activeType:e?e.type:null,timerName:_,timerSegments:h,timerMax:k,activeCount:s.filter(r=>r.status==="active").length,defeatedCount:s.filter(r=>r.status==="defeated").length}})}catch{}}function f(){l&&l.parentNode&&l.parentNode.removeChild(l),Xe(),l=document.createElement("div"),l.className="editor-screen-host",l.style.cssText="width:100%;padding:1rem 0;animation:fadeIn 0.3s ease;";const e=s[$]||null,t=s.map((a,d)=>{const p=de(a.objectiveType,a),b=ee(a.objectiveType),y=d===$&&a.status==="active",c=a.status==="defeated"||a.status==="resolved",x=a.harm/a.maxHarm*100;a.linkedFaction||a.linkedPatron||a.linkedFollower||a.linkedAsset||a.linkedRival;const E=a.maxMeansSuccess===!0,C=b?`${a.name} is defeated!`:E?`✅ ${p.label} succeeded`:`❌ ${p.label} failed`;let U="";a.armorType&&a.armorType!=="none"&&(U=`<span style="font-size:0.6rem;background:rgba(100,180,255,0.15);color:var(--accent);padding:0.05rem 0.35rem;border-radius:10px;flex-shrink:0;">🛡️ ${g(a.armorType)}</span>`);let xe="";a.fatigue>0&&(xe=`<span style="font-size:0.6rem;background:rgba(255,200,0,0.15);color:var(--gold);padding:0.05rem 0.35rem;border-radius:10px;flex-shrink:0;">💤 ${a.fatigue}</span>`);const De=`<button class="combat-weapon-toggle" data-index="${d}" title="${I(Z(a))} — click to change"
            style="font-size:0.6rem;background:rgba(212,175,55,0.12);color:var(--text2);border:1px solid var(--border);padding:0.05rem 0.35rem;border-radius:10px;flex-shrink:0;cursor:pointer;">${at(a)}</button>`;let $e="";if(e&&e.id!==a.id&&e.type!==a.type){const we=ae(a.id,e.id),D=pe(we),O=se(a,we),ke=ie(O,a,D.label),Oe=O==="blocked"?"🚫":O==="penalty"?"⚠️":"📏",Ge=O==="blocked"?"outline:2px solid var(--red);outline-offset:1px;":O==="penalty"?"outline:2px solid var(--orange);outline-offset:1px;":"",V=!K(),We=`Range to ${g(e.name)}: ${D.label} — ${D.desc}`+(V?" (only the GM can change ranges)":" (click to cycle)")+(ke?` — ${g(ke)}`:"");$e=`<span class="range-chip" data-a="${I(a.id)}" data-b="${I(e.id)}" data-gm-only="${V}"
                title="${We}"
                style="font-size:0.65rem; font-weight:700; color:white; background:${D.color};
                       padding:0.05rem 0.4rem; border-radius:10px; flex-shrink:0; ${Ge}
                       ${V?"cursor:default;opacity:0.75;":"cursor:pointer;"}">
                ${V?"🔒 ":""}${Oe} ${D.label}
            </span>`}let R="";return a.linkedFaction&&(R+='<span class="badge faction-badge">🏛️</span>'),a.linkedPatron&&(R+='<span class="badge patron-badge">🌟</span>'),a.linkedFollower&&(R+='<span class="badge follower-badge">👤</span>'),a.linkedAsset&&(R+='<span class="badge asset-badge">📦</span>'),a.linkedRival&&(R+='<span class="badge rival-badge">⚔️</span>'),`
            <div class="combatant-entry ${y?"active":""} ${c?"defeated":""}" data-index="${d}"
                 style="
                display: flex; align-items: center; gap: 0.75rem;
                padding: 0.75rem 1rem;
                background: ${y?"rgba(212,175,55,0.12)":c?"var(--bg3)":"var(--bg2)"};
                border-radius: 10px; margin-bottom: 0.5rem; font-size: 0.9rem;
                border: 2px solid ${y?"var(--gold)":"var(--border)"};
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                transform: ${y?"scale(1.02)":"scale(1)"};
                box-shadow: ${y?"0 0 30px rgba(212,175,55,0.1)":"none"};
                ${c?"opacity: 0.6;":""}
                cursor: pointer;
            ">
                <div class="combatant-number" style="
                    width: 32px; height: 32px; border-radius: 50%;
                    background: ${a.type==="player"?"var(--blue)":a.type==="adversary"?"var(--red)":"var(--bg4)"};
                    display: flex; align-items: center; justify-content: center;
                    font-weight: bold; font-size: 0.7rem; color: white;
                    ${y?"box-shadow: 0 0 20px rgba(212,175,55,0.3);":""}
                ">
                    ${d+1}
                </div>

                <div style="flex: 1; min-width: 0;">
                    <div style="
                        display: flex; align-items: center; justify-content: space-between;
                        margin-bottom: 0.25rem; gap: 0.5rem;
                    ">
                        <div style="display:flex;align-items:center;gap:0.35rem;flex-wrap:wrap;min-width:0;">
                            <span style="
                                font-weight: 600; color: ${y?"var(--gold)":c?"var(--text3)":"var(--text)"};
                                white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
                                transition: color 0.3s ease;
                            ">${g(a.name)}</span>
                            ${a.tl!==void 0?`<span class="creature-tag" style="font-size:0.62rem;background:rgba(255,100,100,0.15);color:var(--red);padding:0.05rem 0.35rem;border-radius:10px;flex-shrink:0;">TL${a.tl}</span>`:""}
                            ${a.class?`<span class="creature-tag" style="font-size:0.62rem;background:rgba(100,180,255,0.15);color:var(--accent);padding:0.05rem 0.35rem;border-radius:10px;flex-shrink:0;">Class ${g(a.class)}</span>`:""}
                            ${a.category?`<span class="badge badge-${qe(a.category)}" style="font-size:0.55rem;flex-shrink:0;">${g(a.category)}</span>`:""}
                            ${U}
                            ${xe}
                            ${De}
                        </div>
                        <div style="display: flex; align-items: center; gap: 0.3rem; flex-shrink: 0;">
                            ${R}
                            ${$e}
                            <span style="font-size: 0.7rem; color: var(--text3);">Init ${a.initiative}</span>
                        </div>
                    </div>

                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        ${b?"":`<span style="font-size:0.65rem;color:var(--text3);white-space:nowrap;">${p.icon} ${g(p.progressLabel)}</span>`}
                        <div style="flex: 1; height: 6px; background: var(--bg4); border-radius: 4px; overflow: hidden;">
                            <div class="harm-bar" style="
                                width: ${x}%; height: 100%;
                                background: ${x>66?"var(--red)":x>33?"var(--orange)":"var(--green)"};
                                border-radius: 4px; transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
                            "></div>
                        </div>
                        <span style="font-size: 0.75rem; color: var(--text2); min-width: 40px; text-align: right;">
                            ${a.harm}/${a.maxHarm}
                        </span>
                    </div>
                    ${!b&&a.status!=="active"?`<div style="font-size:0.7rem;color:${E?"var(--green)":"var(--red)"};margin-top:0.15rem;">${C}</div>`:""}
                </div>

                <div style="display: flex; gap: 0.25rem; flex-shrink: 0; flex-wrap: wrap; align-items:center;">
                    ${b?`
                    <button class="btn btn-xs btn-ghost combat-damage-btn" data-index="${d}" title="Deal damage" style="padding: 0.25rem 0.4rem; font-size: 0.8rem; color: var(--red);">💥</button>
                    <button class="btn btn-xs btn-ghost combat-heal-btn" data-index="${d}" title="Heal" style="padding: 0.25rem 0.4rem; font-size: 0.8rem; color: var(--green);">💚</button>
                    `:`
                    <button class="btn btn-xs btn-ghost combat-damage-btn" data-index="${d}" title="${g(p.progressLabel)} (${p.progressVerb})" style="padding: 0.25rem 0.4rem; font-size: 0.8rem; color: var(--orange);">${p.icon} ${g(p.progressLabel)}</button>
                    <button class="btn btn-xs btn-ghost combat-heal-btn" data-index="${d}" title="${g(p.reliefLabel)} (${p.reliefVerb})" style="padding: 0.25rem 0.4rem; font-size: 0.8rem; color: var(--green);">↩️ ${g(p.reliefLabel)}</button>
                    <button class="btn btn-xs btn-ghost combat-maxmeaning-btn" data-index="${d}" title="Toggle whether hitting max on this clock is success or failure"
                        style="padding: 0.25rem 0.4rem; font-size: 0.7rem; color: var(--text2); border: 1px solid var(--border); border-radius: 6px;">
                        Max = ${E?"✅ Success":"❌ Failure"}
                    </button>
                    `}
                    <button class="btn btn-xs btn-ghost combat-toggle-btn" data-index="${d}" title="Toggle active" style="padding: 0.25rem 0.4rem; font-size: 0.8rem; color: ${a.status==="active"?"var(--green)":"var(--text3)"};">${a.status==="active"?"●":"○"}</button>
                    <button class="btn btn-xs btn-ghost combat-remove-btn" data-index="${d}" title="Remove" style="padding: 0.25rem 0.4rem; font-size: 0.8rem; color: var(--red);">✕</button>
                </div>
            </div>
        `}).join(""),r=j.slice(-5).reverse().map(a=>`
        <div style="
            padding: 0.25rem 0.5rem; font-size: 0.8rem;
            color: ${a.type==="damage"?"var(--red)":a.type==="heal"?"var(--green)":a.type==="turn"?"var(--gold)":"var(--text2)"};
            border-bottom: 1px solid var(--border);
        ">
            <span style="color: var(--text3);">[${a.time}]</span> ${g(a.message)}
        </div>
    `).join(""),o=Ze.map(a=>Se(a,a.name)).join(""),n=s.filter(a=>a.type==="adversary"&&a.sbSpends?.length).flatMap(a=>(a.sbSpends||[]).map(d=>({...d,source:a.name}))),i=n.length?n.map(a=>Se(a,`${a.source}: ${a.name}`)).join(""):'<div style="font-size:0.8rem;color:var(--text3);padding:0.3rem 0;">No creature-specific SB moves in this fight. Use the default moves above.</div>';l.innerHTML=`
        <div class="combat-modal" style="
            background: var(--bg2); padding: 1.75rem; border-radius: 16px;
            max-width: 900px; width: 100%; max-height: 95vh; overflow-y: auto;
            border: 1px solid var(--border); box-shadow: 0 20px 60px rgba(0,0,0,0.5);
            animation: slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        ">
            <!-- Header -->
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:1.25rem;">
                <div>
                    <h2 style="margin:0;color:var(--gold);font-size:1.7rem;display:flex;align-items:center;gap:0.5rem;">
                        ⚔️ Combat Tracker
                    </h2>
                    <div style="color:var(--text2);font-size:0.85rem;margin-top:0.25rem;">
                        ${s.length} combatants · Round ${A} · ${s.filter(a=>a.status==="active").length} active
                        <span style="margin-left:0.5rem;font-size:0.7rem;color:var(--text3);">[Space: next · R: reset timer]</span>
                    </div>
                </div>
                <button id="combat-close" style="
                    background: var(--bg3); border: 1px solid var(--border);
                    color: var(--text2); font-size: 1.25rem; cursor: pointer;
                    width: 36px; height: 36px; border-radius: 50%;
                    display: flex; align-items: center; justify-content: center;
                ">✕</button>
            </div>

            <!-- Stats Grid -->
            <div style="
                display: grid; grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
                gap: 0.75rem; background: var(--bg3); padding: 1rem; border-radius: 12px;
                margin-bottom: 1.25rem; border: 1px solid var(--border);
            ">
                <div style="text-align: center;">
                    <div style="font-size: 0.7rem; color: var(--text3); text-transform: uppercase;">Round</div>
                    <div style="font-size: 2rem; font-weight: 700; color: var(--gold);">${A}</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 0.7rem; color: var(--text3); text-transform: uppercase;">Active</div>
                    <div style="font-size: 2rem; font-weight: 700; color: var(--green);">${s.filter(a=>a.status==="active").length}</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 0.7rem; color: var(--text3); text-transform: uppercase;">Defeated</div>
                    <div style="font-size: 2rem; font-weight: 700; color: var(--red);">${s.filter(a=>a.status==="defeated").length}</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 0.7rem; color: var(--text3); text-transform: uppercase;">Linked</div>
                    <div style="font-size: 2rem; font-weight: 700; color: var(--purple);">
                        ${s.filter(a=>a.linkedFaction||a.linkedPatron||a.linkedFollower||a.linkedAsset||a.linkedRival).length}
                    </div>
                </div>
            </div>

            <!-- Timer -->
            <div style="
                background: var(--bg3); padding: 1rem; border-radius: 12px;
                margin-bottom: 1.25rem; border: 1px solid var(--border);
            ">
                <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.75rem;margin-bottom:0.75rem;">
                    <div style="display:flex;align-items:center;gap:0.5rem;">
                        <span style="font-size:1.25rem;">⏱️</span>
                        <div>
                            <div style="font-weight:600;font-size:1rem;transition:color 0.3s ease;">${g(_)}</div>
                            <div style="font-size:0.8rem;color:var(--text2);">${h} of ${k} segments</div>
                        </div>
                    </div>
                    <div style="display:flex;gap:0.5rem;">
                        <button class="btn btn-sm btn-primary" id="combat-timer-tick" style="padding:0.4rem 0.75rem;font-size:0.85rem;">+1 Segment</button>
                        <button class="btn btn-sm btn-ghost" id="combat-timer-reset" style="padding:0.4rem 0.75rem;font-size:0.85rem;">↺ Reset</button>
                        <button class="btn btn-sm btn-ghost" id="combat-timer-rename" style="padding:0.4rem 0.75rem;font-size:0.85rem;">✏️</button>
                    </div>
                </div>
                <div class="timer-track" style="width:100%;height:12px;background:var(--bg4);border-radius:6px;overflow:hidden;position:relative;">
                    <div class="timer-fill" style="
                        width: ${h/k*100}%; height: 100%;
                        background: ${h>=k?"var(--red)":"var(--gold)"};
                        border-radius: 6px; transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);
                        ${h>0?"box-shadow: 0 0 20px rgba(212,175,55,0.2);":""}
                    "></div>
                </div>
                ${h>=k?`
                    <div style="color:var(--red);font-size:0.85rem;margin-top:0.5rem;animation:pulse 1.5s infinite;">
                        ⚠️ Timer Complete!
                    </div>
                `:""}
            </div>

            <!-- Combatants -->
            <div style="margin-bottom: 1.25rem;">
                <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.75rem;margin-bottom:0.75rem;">
                    <h3 style="margin:0;color:var(--gold);">👾 Combatants</h3>
                    <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
                        <button class="btn btn-sm btn-primary" id="combat-add-combatant" style="padding:0.4rem 0.75rem;font-size:0.85rem;">+ Adversary</button>
                        <button class="btn btn-sm btn-ghost" id="combat-add-player" style="padding:0.4rem 0.75rem;font-size:0.85rem;">👤 Player</button>
                        <button class="btn btn-sm btn-ghost" id="combat-import-factions" style="padding:0.4rem 0.75rem;font-size:0.85rem;">🏛️ Import</button>
                        <button class="btn btn-sm btn-ghost" id="combat-import-bestiary" style="padding:0.4rem 0.75rem;font-size:0.85rem;">📖 Bestiary</button>
                        <button class="btn btn-sm btn-ghost" id="combat-sort" style="padding:0.4rem 0.75rem;font-size:0.85rem;">🔄 Sort</button>
                        <button class="btn btn-sm ${G?"btn-gold":"btn-ghost"}" id="combat-toggle-ranges" style="padding:0.4rem 0.75rem;font-size:0.85rem;">📏 Ranges</button>
                    </div>
                </div>
                <div id="combatant-list" style="max-height: 380px; overflow-y: auto; padding-right: 0.5rem;">
                    ${t||'<div style="color:var(--text3);padding:2rem;text-align:center;">No combatants. Add some to begin!</div>'}
                </div>
            </div>

            <!-- Story Beats Panel -->
            <div style="background:var(--bg3);padding:1rem;border-radius:12px;margin-bottom:1.25rem;border:1px solid var(--border);">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;margin-bottom:0.6rem;">
                    <h3 style="margin:0;color:var(--danger);">⚡ Story Beats</h3>
                    <div style="display:flex;align-items:center;gap:0.3rem;">
                        <span style="font-size:0.8rem;color:var(--text2);">Bank:</span>
                        <button class="btn btn-xs btn-ghost sb-minus" style="font-weight:bold;">−</button>
                        <input type="number" id="sb-bank-input" value="${w}" min="0" style="width:55px;text-align:center;font-size:0.8rem;background:var(--bg2);border:1px solid var(--border);border-radius:4px;padding:0.15rem;" />
                        <button class="btn btn-xs btn-ghost sb-plus" style="font-weight:bold;">+</button>
                    </div>
                </div>
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:0.4rem;">
                    ${o}
                    ${i}
                </div>
            </div>

            <!-- Range Grid -->
            ${G?ot():""}

            <!-- Combat Log -->
            ${j.length>0?`
            <div style="background:var(--bg3);border-radius:12px;padding:0.75rem;margin-bottom:1.25rem;border:1px solid var(--border);max-height:140px;overflow-y:auto;">
                <div style="font-size:0.7rem;color:var(--text3);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.25rem;">📜 Combat Log</div>
                ${r}
            </div>
            `:""}

            <!-- Controls -->
            <div style="display:flex;flex-wrap:wrap;gap:0.75rem;border-top:1px solid var(--border);padding-top:1.25rem;">
                <button class="btn btn-primary" id="combat-next" style="flex:1;min-width:100px;padding:0.6rem;">⏭️ Next Turn</button>
                <button class="btn btn-ghost" id="combat-end-round" style="flex:1;min-width:100px;padding:0.6rem;">🔚 End Round</button>
                <button class="btn btn-ghost" id="combat-clear-log" style="flex:0 0 auto;padding:0.6rem;">🗑️ Log</button>
                <button class="btn btn-danger" id="combat-close-tracker" style="flex:1;min-width:100px;padding:0.6rem;">✖️ Close</button>
            </div>
        </div>

        <style>
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes slideUp { from { opacity: 0; transform: translateY(30px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
            @keyframes pulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 1; } }
            .combatant-entry { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
            .combatant-entry:hover:not(.defeated) { background: var(--bg4) !important; transform: translateX(4px); }
            .combatant-entry.active { border-color: var(--gold) !important; background: rgba(212,175,55,0.1) !important; }
            .combatant-entry.defeated .combatant-number { background: var(--bg4) !important; }
            #combatant-list::-webkit-scrollbar { width: 6px; }
            #combatant-list::-webkit-scrollbar-track { background: var(--bg3); border-radius: 3px; }
            #combatant-list::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
            #combatant-list::-webkit-scrollbar-thumb:hover { background: var(--text3); }
            .badge { display: inline-block; padding: 0.05rem 0.35rem; border-radius: 10px; font-size: 0.62rem; font-weight: 600; color: white; line-height: 1.4; }
            .faction-badge { background: var(--gold); }
            .patron-badge { background: var(--purple); }
            .follower-badge { background: var(--green); }
            .asset-badge { background: var(--blue); }
            .rival-badge { background: var(--red); }
            .btn { transition: all 0.2s ease; }
            .btn:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
            .btn:active { transform: scale(0.96); }
        </style>
    `;const u=document.getElementById("app-content")||document.body;N||(N=Array.from(u.children),N.forEach(a=>{a.style.display="none"})),u.appendChild(l),window.scrollTo({top:0}),l.querySelector("#combat-close")?.addEventListener("click",Te),l.querySelector("#combat-close-tracker")?.addEventListener("click",Te),l.querySelector("#combat-timer-tick")?.addEventListener("click",()=>{h=Math.min(h+1,k),v("info",`Timer advanced to ${h}/${k}`),f(),m(`⏱️ Timer advanced to ${h}/${k}`,"info")}),l.querySelector("#combat-timer-reset")?.addEventListener("click",()=>{h=0,v("info","Timer reset"),f(),m("⏱️ Timer reset","info")}),l.querySelector("#combat-timer-rename")?.addEventListener("click",()=>{const a=prompt("Enter timer name:",_);a&&(_=a,v("info",`Timer renamed to "${_}"`),f())}),l.querySelector("#combat-add-combatant")?.addEventListener("click",it),l.querySelector("#combat-add-player")?.addEventListener("click",lt),l.querySelector("#combat-import-factions")?.addEventListener("click",dt),l.querySelector("#combat-import-bestiary")?.addEventListener("click",ct),l.querySelector("#combat-sort")?.addEventListener("click",Y),l.querySelector("#combat-toggle-ranges")?.addEventListener("click",()=>{G=!G,f()}),l.querySelectorAll(".range-chip").forEach(a=>{a.addEventListener("click",d=>{if(d.stopPropagation(),!K()){m("Only the GM can change ranges.","warning");return}Ce(a.dataset.a,a.dataset.b),f()})}),l.querySelectorAll(".range-cell").forEach(a=>{a.addEventListener("click",d=>{if(d.stopPropagation(),!K()){m("Only the GM can change ranges.","warning");return}Ce(a.dataset.a,a.dataset.b),f()})}),l.querySelector("#combat-next")?.addEventListener("click",mt),l.querySelector("#combat-end-round")?.addEventListener("click",Fe),l.querySelector("#combat-clear-log")?.addEventListener("click",()=>{j=[],f(),m("🧹 Combat log cleared","info")}),l.querySelector(".sb-minus")?.addEventListener("click",()=>Le(-1)),l.querySelector(".sb-plus")?.addEventListener("click",()=>Le(1)),l.querySelector("#sb-bank-input")?.addEventListener("change",a=>{const d=parseInt(a.target.value,10);w=isNaN(d)?0:Math.max(0,d),ce()}),l.querySelectorAll(".sb-spend-btn").forEach(a=>{a.addEventListener("click",()=>{const d=parseInt(a.dataset.cost,10),p=a.dataset.label;Qe(d,p)})}),l.querySelectorAll(".combatant-entry").forEach(a=>{a.addEventListener("click",d=>{if(d.target.closest("button"))return;const p=parseInt(a.dataset.index);!isNaN(p)&&p>=0&&p<s.length&&s[p].status==="active"&&($=p,f(),v("info",`Focused on ${s[p].name}`),m(`🎯 Focused on ${s[p].name}`,"info"))})}),l.querySelectorAll(".combat-damage-btn").forEach(a=>{a.addEventListener("click",d=>{d.stopPropagation(),pt(parseInt(a.dataset.index))})}),l.querySelectorAll(".combat-heal-btn").forEach(a=>{a.addEventListener("click",d=>{d.stopPropagation(),ut(parseInt(a.dataset.index))})}),l.querySelectorAll(".combat-toggle-btn").forEach(a=>{a.addEventListener("click",d=>{d.stopPropagation(),gt(parseInt(a.dataset.index))})}),l.querySelectorAll(".combat-remove-btn").forEach(a=>{a.addEventListener("click",d=>{d.stopPropagation(),vt(parseInt(a.dataset.index))})}),l.querySelectorAll(".combat-weapon-toggle").forEach(a=>{a.addEventListener("click",d=>{d.stopPropagation(),ft(parseInt(a.dataset.index))})}),l.querySelectorAll(".combat-maxmeaning-btn").forEach(a=>{a.addEventListener("click",d=>{d.stopPropagation(),bt(parseInt(a.dataset.index))})}),L&&(document.removeEventListener("keydown",L),L=null),L=a=>{if(!l||!l.parentNode){document.removeEventListener("keydown",L),L=null;return}a.key===" "&&!a.target.matches("input, textarea, select")&&(a.preventDefault(),l.querySelector("#combat-next")?.click()),(a.key==="r"||a.key==="R")&&!a.target.matches("input, textarea, select")&&(a.preventDefault(),l.querySelector("#combat-timer-reset")?.click())},document.addEventListener("keydown",L),st()}function Te(){if(L&&(document.removeEventListener("keydown",L),L=null),l&&l.parentNode&&l.parentNode.removeChild(l),l=null,N&&(N.forEach(e=>{e.style.display=""}),N=null),le())try{Ae({type:"combat-status-update",combat:null})}catch{}B=null}function v(e,t){const r=new Date().toLocaleTimeString();j.push({type:e,message:t,time:r}),j.length>50&&j.shift()}function Ne(e){const t=(prompt("Weapon class: light, medium, heavy, or ranged",e||"medium")||e||"medium").toLowerCase();return X[t]?t:"medium"}function it(){const e=prompt("Enter adversary name:");if(!e)return;const t=parseInt(prompt("Enter initiative (1-20):",Math.floor(Math.random()*20)+1)||"10"),r=parseInt(prompt("Max Harm (1-20):","3")||"3"),o=prompt("Armor type: none, light, medium, heavy (default: none)","none")||"none",n=["none","light","medium","heavy"].includes(o)?o:"none",i=Ne("medium"),u={id:"combat-"+Date.now()+"-"+Math.random().toString(36).substr(2,9),name:e,initiative:Math.min(Math.max(t,1),20),harm:0,fatigue:0,armorType:n,weaponClass:i,maxHarm:Math.min(Math.max(r,1),20),status:"active",notes:"",type:"adversary",objectiveType:W,customLabel:q,customTickLabel:P,linkedFaction:ue(e),linkedPatron:be(e),linkedFollower:ge(e),linkedAsset:fe(e),linkedRival:ve(e)};s.push(u),re(u),Y(),v("info",`Added adversary: ${e}`),f(),m(`👾 Added ${e}`,"success")}function lt(){const e=prompt("Enter player name:");if(!e)return;const t=parseInt(prompt("Enter initiative (1-20):",Math.floor(Math.random()*20)+1)||"10"),r=parseInt(prompt("Max Harm (1-20):","4")||"4"),o=prompt("Armor type: none, light, medium, heavy (default: none)","none")||"none",n=["none","light","medium","heavy"].includes(o)?o:"none",i=Ne("medium"),u={id:"combat-"+Date.now()+"-"+Math.random().toString(36).substr(2,9),name:`👤 ${e}`,initiative:Math.min(Math.max(t,1),20),harm:0,fatigue:0,armorType:n,weaponClass:i,maxHarm:Math.min(Math.max(r,1),20),status:"active",notes:"Player character",type:"player",objectiveType:W,customLabel:q,customTickLabel:P};s.push(u),re(u),Y(),v("info",`Added player: ${e}`),f(),m(`👤 Added player ${e}`,"success")}function dt(){const e=S();if(!e.factions){m("No factions data found.","warning");return}const t=e.factions.factions||[];if(t.length===0){m("No factions to import from.","warning");return}const r=t.map((a,d)=>`${d+1}. ${a.name}`).join(`
`),o=prompt(`Select a faction to import as a combatant:
${r}

Enter number:`);if(!o)return;const n=parseInt(o)-1;if(n<0||n>=t.length){m("Invalid selection","error");return}const i=t[n],u={id:"combat-"+Date.now()+"-"+Math.random().toString(36).substr(2,9),name:i.name,initiative:Math.floor(Math.random()*20)+5+(i.standing||0),harm:0,fatigue:0,armorType:"none",maxHarm:4+Math.abs(i.standing||0),status:"active",notes:`Faction: ${i.agenda||"No agenda"}`,type:"adversary",objectiveType:W,customLabel:q,customTickLabel:P,linkedFaction:i};s.push(u),re(u),Y(),v("info",`Imported faction: ${i.name}`),f(),m(`🏛️ Imported ${i.name}`,"success")}async function ct(){const e=await Pe();if(!e||e.length===0){m("Bestiary not loaded yet.","error");return}const t=l?.querySelector("#bestiary-import-panel");t&&t.remove();const r=document.createElement("div");r.id="bestiary-import-panel",r.style.cssText=`
        background: var(--bg-panel); padding: 1rem; border-radius: 10px;
        border: 1px solid var(--border); margin: 0.75rem auto 0; max-width: 520px;
    `,r.innerHTML=`
        <h3 style="margin-top:0;">📖 Import from Bestiary</h3>
        <input type="text" id="bestiary-import-search" placeholder="Search creatures..."
               style="width:100%; padding:0.4rem; margin-bottom:0.5rem;">
        <div id="bestiary-import-list" style="max-height:300px; overflow-y:auto;"></div>
        <button id="bestiary-import-close" class="btn btn-sm btn-ghost"
                style="margin-top:0.5rem;">Close</button>
    `,l?.appendChild(r);const o=r.querySelector("#bestiary-import-search"),n=r.querySelector("#bestiary-import-list"),i=r.querySelector("#bestiary-import-close");function u(a=""){const d=a.toLowerCase().trim(),p=e.filter(b=>(b.name||"").toLowerCase().includes(d)||(z(b)||"").toLowerCase().includes(d));if(p.length===0){n.innerHTML='<div style="color:var(--text3);padding:1rem;">No creatures found.</div>';return}n.innerHTML=p.map(b=>`
            <div class="bestiary-import-item" data-name="${I(b.name)}"
                 style="padding:0.5rem; border-bottom:1px solid var(--border); cursor:pointer;
                        display:flex; justify-content:space-between; align-items:center;flex-wrap:wrap;gap:0.4rem;">
                <div style="display:flex;align-items:center;gap:0.4rem;flex-wrap:wrap;">
                    <strong style="font-size:0.9rem;">${g(b.name)}</strong>
                    ${b.tl!==void 0?`<span style="font-size:0.65rem;color:var(--red);">TL${b.tl}</span>`:""}
                    ${b.class?`<span style="font-size:0.65rem;color:var(--accent);">Class ${g(b.class)}</span>`:""}
                    ${b.category?`<span class="badge badge-${qe(b.category)}" style="font-size:0.6rem;color:white;">${g(b.category)}</span>`:""}
                </div>
                <span style="font-size:0.75rem;color:var(--text3);max-width:220px;overflow:hidden;text-overflow:ellipsis;">
                    ${g((z(b)||"").slice(0,60))}${(z(b)||"").length>60?"…":""}
                </span>
            </div>
        `).join(""),n.querySelectorAll(".bestiary-import-item").forEach(b=>{b.addEventListener("click",()=>{const y=b.dataset.name,c=e.find(C=>C.name===y);if(!c)return;const x=S().encounters?.find(C=>String(C.id)===String(B));x&&(x.adversaries||(x.adversaries=[]),x.adversaries.some(C=>C.name.toLowerCase()===y.toLowerCase())||(x.adversaries.push({name:c.name,body:z(c)||"",tl:c.tl,class:c.class||"",category:c.category||"",stats:c.stats||{},sb_spends:c.sb_spends||[],armorType:"none",weaponClass:Q(c)}),Me()));const E={id:"combat-"+Date.now()+"-"+Math.random().toString(36).substr(2,9),name:c.name||"Adversary",initiative:Math.floor(Math.random()*20)+1,harm:0,fatigue:0,armorType:"none",weaponClass:Q(c),maxHarm:Be(c.tl),status:"active",notes:z(c)||"",type:"adversary",objectiveType:W,customLabel:q,customTickLabel:P,tl:c.tl,class:c.class||"",category:c.category||"",sbSpends:c.sb_spends||[],stats:c.stats||{},linkedFaction:ue(c.name),linkedPatron:be(c.name),linkedFollower:ge(c.name),linkedAsset:fe(c.name),linkedRival:ve(c.name)};s.push(E),re(E),Y(),v("info",`Imported bestiary creature: ${c.name}`),f(),m(`📖 Imported ${c.name}`,"success"),r.remove()})})}o.addEventListener("input",a=>u(a.target.value)),i.addEventListener("click",()=>r.remove()),u(""),o.focus()}function Y(){s.sort((e,t)=>e.status==="defeated"&&t.status!=="defeated"?1:e.status!=="defeated"&&t.status==="defeated"?-1:t.initiative-e.initiative),$=0,v("info","Sorted combatants by initiative"),f(),m("🔄 Combatants sorted by initiative","info")}function mt(){if(s.filter(r=>r.status==="active").length===0){m("No active combatants.","info");return}let e=($+1)%s.length,t=0;for(;t<s.length;){if(s[e].status==="active"){$=e,v("turn",`${s[$].name}'s turn`),f(),m(`⏭️ ${s[$].name}'s turn`,"info");return}e=(e+1)%s.length,t++}Fe()}function Fe(){A++;const e=s.findIndex(t=>t.status==="active");e!==-1&&($=e),v("info",`Round ${A} begins`),h=Math.min(h+1,k),f(),m(`🔚 Round ${A} begins`,"info"),h>=k&&(v("warning","Timer completed!"),m("⏱️ Timer completed!","warning"))}function pt(e){if(e<0||e>=s.length)return;const t=s[e],r=ee(t.objectiveType),o=de(t.objectiveType,t),n=parseInt(prompt(r?"Damage amount:":`${o.progressLabel} amount:`,"1")||"1");if(isNaN(n)||n<1){m("Invalid amount.","error");return}if(!r){if(t.harm=Math.min(t.harm+n,t.maxHarm),v("damage",`${t.name} ${o.progressVerb}s ${n} ${o.progressLabel} (${t.harm}/${t.maxHarm})`),t.harm>=t.maxHarm&&t.status!=="resolved"){t.status="resolved";const a=t.maxMeansSuccess===!0;v("damage",`${t.name}'s ${o.label} clock is full — ${a?"succeeded":"failed"}!`),m(`${a?"✅":"❌"} ${t.name}'s ${o.label} clock is full!`,a?"success":"error")}else m(`${o.icon} ${t.name}: ${o.progressLabel} ${t.harm}/${t.maxHarm}`,"warning");f();return}const i=t.armorType||"none",u=et(n,i);u.fatigue>0&&(t.fatigue=(t.fatigue||0)+u.fatigue,v("damage",`${t.name} gains ${u.fatigue} Fatigue from armor (${i})`)),u.harm>0?(t.harm=Math.min(t.harm+u.harm,t.maxHarm),v("damage",`${t.name} takes ${u.harm} harm (${t.harm}/${t.maxHarm})`),t.harm>=t.maxHarm&&t.status!=="defeated"?(t.status="defeated",v("damage",`${t.name} is defeated!`),m(`💀 ${t.name} is defeated!`,"error")):m(`💥 ${t.name} takes ${u.harm} harm (${t.harm}/${t.maxHarm})`,"warning")):u.fatigue>0?m(`🛡️ ${t.name} absorbs harm, gains ${u.fatigue} Fatigue`,"info"):m(`🛡️ ${t.name}'s armor completely absorbs the damage.`,"info"),f()}function ut(e){if(e<0||e>=s.length)return;const t=s[e],r=ee(t.objectiveType),o=de(t.objectiveType,t),n=parseInt(prompt(r?"Heal amount:":`${o.reliefLabel} amount:`,"1")||"1");if(!r){t.harm=Math.max(t.harm-n,0),t.status==="resolved"&&t.harm<t.maxHarm?(t.status="active",v("heal",`${t.name}'s ${o.label} clock reopens — no longer resolved.`),m(`${o.icon} ${t.name}'s clock reopens`,"success")):(v("heal",`${t.name} ${o.reliefVerb}s ${n} ${o.reliefLabel} (${t.harm}/${t.maxHarm})`),m(`${o.icon} ${t.name}: ${o.reliefLabel} ${t.harm}/${t.maxHarm}`,"success")),f();return}t.harm=Math.max(t.harm-n,0),t.status==="defeated"&&t.harm<t.maxHarm?(t.status="active",v("heal",`${t.name} revived!`),m(`💚 ${t.name} revived!`,"success")):(v("heal",`${t.name} healed for ${n} (${t.harm}/${t.maxHarm})`),m(`💚 ${t.name} healed for ${n}`,"success")),f()}function bt(e){if(e<0||e>=s.length)return;const t=s[e];ee(t.objectiveType)||(t.maxMeansSuccess=t.maxMeansSuccess!==!0,f())}function gt(e){if(e>=0&&e<s.length){const t=s[e];t.status=t.status==="active"?"inactive":"active",v("info",`${t.name} ${t.status==="active"?"activated":"deactivated"}`),m(`${t.name} ${t.status==="active"?"activated":"deactivated"}`,"info"),f()}}var ne=["light","medium","heavy","ranged"];function ft(e){if(e<0||e>=s.length)return;const t=s[e],r=ne.indexOf(t.weaponClass);t.weaponClass=ne[(r+1)%ne.length],v("info",`${t.name} switched to ${Z(t)}`),f()}function vt(e){if(e>=0&&e<s.length&&confirm(`Remove ${s[e].name}?`)){const t=s[e].name,r=s[e].id;s.splice(e,1),nt(r),$>=s.length&&($=Math.max(0,s.length-1)),v("info",`Removed ${t}`),f(),m(`🗑️ Removed ${t}`,"info")}}function qe(e){return{beast:"green",undead:"red",humanoid:"blue",fiend:"purple",construct:"gold",plant:"green",dragon:"red",elemental:"blue",celestial:"gold",abomination:"purple"}[(e||"").toLowerCase()]||"gold"}function yt(e){return!!l&&String(B)===String(e)}function ht(){return s.map(e=>({id:e.id,name:e.name,type:e.type,status:e.status,harm:e.harm,maxHarm:e.maxHarm,fatigue:e.fatigue||0,armorType:e.armorType||"none",initiative:e.initiative,weaponClass:e.weaponClass,objectiveType:e.objectiveType||"combat",customLabel:e.customLabel||"",customTickLabel:e.customTickLabel||"",maxMeansSuccess:e.maxMeansSuccess===!0}))}function xt(){const e=[...s].sort((r,o)=>(o.initiative||0)-(r.initiative||0)),t=s[$]||null;return{encounterId:B,isModalOpen:!!l,round:A,activeCombatantId:t?.id||null,combatants:e.map(r=>({id:r.id,name:r.name,type:r.type,status:r.status,harm:r.harm,maxHarm:r.maxHarm,fatigue:r.fatigue||0,armorType:r.armorType||"none",initiative:r.initiative,weaponClass:r.weaponClass,objectiveType:r.objectiveType||"combat",customLabel:r.customLabel||"",customTickLabel:r.customTickLabel||"",maxMeansSuccess:r.maxMeansSuccess===!0}))}}function $t(e,t){return ae(e,t)}function wt(e,t,r){if(!l)return!1;const o=s.find(i=>(i.name||"").toLowerCase()===(e||"").toLowerCase()),n=s.find(i=>(i.name||"").toLowerCase()===(t||"").toLowerCase());return!o||!n?!1:(He(o.id,n.id,r),f(),!0)}var kt={openTracker:_e},M=[],oe={},Lt=["/data/bestiary.json","/data/bestiary/bestiary.json","data/bestiary.json","data/bestiary/bestiary.json","./data/bestiary.json","./data/bestiary/bestiary.json"],Ee="./data/bestiary/",J="fates-edge-bestiary-cache",St=[{id:"goblin-scavenger",name:"Goblin Scavenger",category:"humanoid",tl:1,class:"I",description:"A small, green-skinned creature with sharp teeth and a greedy glint."},{id:"skeleton-knight",name:"Skeleton Knight",category:"undead",tl:2,class:"II",description:"An animated suit of armor with hollow eye sockets glowing with pale blue light."},{id:"thorn-dryad",name:"Thorn Dryad",category:"fey",tl:3,class:"III",description:"A fey creature with bark-like skin and thorny vines for hair."}];function H(e){if(e==null)return"";if(typeof e=="string")return e;if(typeof e=="number"||typeof e=="boolean")return String(e);if(Array.isArray(e))return e.map(t=>H(t)).join(", ");if(typeof e=="object"){if(e.name)return H(e.name);if(e.label)return H(e.label);if(e.description)return H(e.description);if(e.lore)return H(e.lore);try{return JSON.stringify(e)}catch{return"[object]"}}return String(e)}function ye(e){if(!e||typeof e!="object"||Array.isArray(e)||e.name)return e;const t=Object.keys(e);if(t.length===1&&e[t[0]]&&typeof e[t[0]]=="object"){const r=t[0],o=e[t[0]];return{name:r,description:o.summary||o.lore||o.description||"",summary:o.summary||"",lore:o.lore||"",locations:o.locations||[],connections:o.connections||[],page:o.page||"",tl:o.tl,class:o.class,nature:o.nature,services:o.services||[],price:o.price,signs:o.signs||[],sb_spends:o.sb_spends||null,...o}}return e}function he(e){if(!e)return e;let t=ye(e);return t={...t},!t.name&&t.title&&(t.name=t.title),t.description&&typeof t.description=="object"&&(t.description.description?(t._rawDescription=t.description,t.description=t.description.description):t.lore&&t.lore.description&&(t._rawDescription=t.description,t.description=t.lore.description)),t.tl!==void 0&&t.tl!==null&&(t.tl=parseInt(t.tl,10)),t}function Ct(e,t){const r=(e.name||e.title||"").toLowerCase(),o=(t.name||t.title||"").toLowerCase();return r.localeCompare(o)}function z(e){if(!e)return"No description available.";if(typeof e.description=="string"&&e.description)return e.description;if(e.description&&typeof e.description=="object"){if(e.description.description)return e.description.description;if(e.description.lore)return e.description.lore;if(e.description.quote)return e.description.quote;if(e.description.text)return e.description.text;let t=[];if(e.description.followers&&t.push(e.description.followers),e.description.apocalyptic_aspect&&t.push(e.description.apocalyptic_aspect),t.length>0)return t.join(`

`)}if(e.summary)return e.summary;if(e.lore&&typeof e.lore=="object"){if(e.lore.description)return e.lore.description;if(e.lore.lore)return e.lore.lore}return typeof e.lore=="string"?e.lore:H(e.description)||"No description available."}async function Tt(){for(const e of Lt)try{const t=e+(e.includes("?")?"&":"?")+"t="+Date.now(),r=await fetch(t,{cache:"no-cache"});if(r.ok){const o=await r.json();if(Array.isArray(o)&&o.length>0){const n=o.map(ye).filter(i=>i&&i.name);if(n.length>0)return console.log(`[Bestiary] Loaded from ${e} (${n.length} entries)`),n.map(he);console.warn(`[Bestiary] ${e} returned ${o.length} entries but none had a resolvable name after flattening.`)}}}catch{}return null}async function Et(){const e=await Ke(Ee);if(e.length===0)return null;const t=[];for(const r of e)try{const o=await fetch(`${Ee}${r}.json?t=${Date.now()}`,{cache:"no-cache"});if(o.ok){const n=ye(await o.json());n.id||(n.id=r),t.push(he(n))}}catch{}return t.length>0?(console.log(`[Bestiary] Loaded ${t.length} creatures from individual files via discovery`),t.sort(Ct)):null}async function Mt(){return console.log("[Bestiary] Using hardcoded fallback entries"),St.map(he)}async function Pe(){try{const t=sessionStorage.getItem(J);if(t){const r=JSON.parse(t);if(Array.isArray(r)&&r.length>0)return console.log(`[Bestiary] Loaded ${r.length} entries from cache`),M=r,M}}catch{}let e=await Tt();if(e){M=e;try{sessionStorage.setItem(J,JSON.stringify(e))}catch{}return M}if(e=await Et(),e){M=e;try{sessionStorage.setItem(J,JSON.stringify(e))}catch{}return M}e=await Mt(),M=e;try{sessionStorage.setItem(J,JSON.stringify(e))}catch{}return M}async function qt(){try{const e=await fetch("/data/wiki.json?t="+Date.now(),{cache:"no-cache"});if(!e.ok)throw new Error(`HTTP ${e.status}`);return oe=await e.json()||{},oe}catch(e){return console.warn("Failed to load wiki:",e),oe={},{}}}window.openWiki=function(e){const t=new CustomEvent("wiki-navigate",{detail:{query:e}});document.dispatchEvent(t)};function Pt(e){if(!e||!e.name){m("Invalid creature data.","error");return}const t=z(e),r=S();r.encounters||(r.encounters=[]);let o=r.encounters.find(n=>n.status==="active")||r.encounters[0];if(!o){const n={id:"enc-"+Date.now()+"-"+Math.random().toString(36).substr(2,4),title:`Encounter with ${e.name}`,body:t||"",difficulty:e.tl||2,location:"",status:"draft",adversaries:[],created:Date.now()};r.encounters.push(n),o=n}if(o.adversaries.some(n=>n.name.toLowerCase()===e.name.toLowerCase()))m(`"${e.name}" already in encounter.`,"info");else{const n=e.stats?{...e.stats}:{};!n.hp&&e.tl&&(n.hp=e.tl*10+10),n.hp||(n.hp=20),o.adversaries.push({name:e.name,body:t||"",tier:e.tl||2,stats:n,_original:{tl:e.tl,class:e.class,nature:e.nature}}),Me(),m(`⚔️ Added "${e.name}" as adversary.`,"success");try{ze(`⚔️ Adversary added: ${e.name}`,"warning"),je("adversary_added",{name:e.name})}catch{}}}export{Ft as a,qt as i,z as n,_e as o,Pe as r,Pt as t};
