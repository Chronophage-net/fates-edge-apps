const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/bestiary.CPB8-5uX.js","assets/rolldown-runtime.BQ-_32WO.js","assets/utils.lBShoim5.js","assets/state.42sFgcOQ.js","assets/Toast.DDAtBIAw.js","assets/websocket.Dmklt06W.js","assets/preload-helper.BATLnrmA.js","assets/main.hiOZSyFC.js","assets/sync.i5xh8ufD.js","assets/main.DcCFXHiG.css","assets/objective-types.CuiNbA6A.js","assets/gm-tools.BcndmVEn.js","assets/talent-effects.CY-tOZj6.js","assets/decks.CN3iDKhv.js","assets/discovery.I-q7Uafb.js","assets/adventure-manager.BYGz956n.js"])))=>i.map(i=>d[i]);
import{t as jt}from"./rolldown-runtime.BQ-_32WO.js";import{d as j,f as ks,g as Pe,h as xs,i as $,m as at,p as Cs,s as ht,u as Ts}from"./utils.lBShoim5.js";import{D as Ss,_ as F,a as Ms,b as O,c as ot,p as Es,w as Ls,y as _s}from"./state.42sFgcOQ.js";import{n as u}from"./Toast.DDAtBIAw.js";import{t as B}from"./preload-helper.BATLnrmA.js";import{A as yt,C as Ce,S as As,T as Rs,_ as Is,a as Ds,b as zs,c as De,d as se,g as $t,h as Hs,i as Vs,j as Ps,l as Ns,o as js,p as D,t as qs,u as Ne,v as wt,x as Bs,y as R}from"./websocket.Dmklt06W.js";import{t as qt}from"./talent-effects.CY-tOZj6.js";import{n as Bt,t as ze}from"./roller.D0W8f2sx.js";import{t as m}from"./vtt-store.Dch8u3Zx.js";import{a as it,c as lt,i as je,n as ct,o as Ot,r as qe,s as dt,t as Ee}from"./voice.D0Q3-VlJ.js";var me={maxChatMessages:200,chatAutoScroll:!0,presenceUpdateInterval:5e3},ke={SYSTEM:"System",ROLL:"Roll",OOC:"OOC",GM:"GM",DECK:"Deck"},Os={Stealth:{attr:"body",skill:"stealth"},Investigate:{attr:"wits",skill:"investigation"},Perception:{attr:"wits",skill:"insight"},Athletics:{attr:"body",skill:"athletics"},Acrobatics:{attr:"body",skill:"athletics"},Persuasion:{attr:"presence",skill:"sway"},Deception:{attr:"presence",skill:"deception"},Insight:{attr:"spirit",skill:"insight"},Survival:{attr:"body",skill:"endurance"},Medicine:{attr:"wits",skill:"medicine"},Arcana:{attr:"spirit",skill:"arcana"},Intimidation:{attr:"presence",skill:"sway"}};function Gs(e){const t=typeof window<"u"&&window.DOMPurify?window.DOMPurify:null;return t&&typeof t.sanitize=="function"?t.sanitize(e,{ALLOWED_TAGS:["div","span","p","br","b","i","strong","em","u","h1","h2","h3","h4","ul","ol","li","blockquote","pre","code","hr","a","img","table","thead","tbody","tr","th","td"],ALLOWED_ATTR:["href","target","src","alt","title","class","id","style","data-*","width","height"],ALLOW_DATA_ATTR:!0,ADD_ATTR:["target"],FORBID_TAGS:["script","style","iframe","object","embed"],FORBID_ATTR:["onerror","onload","onclick","onmouseover"]}):String(e).replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi,"").replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi,"").replace(/href\s*=\s*["']\s*javascript:/gi,'href="#"')}var V=null;function Be(e){V=e}function f(e){return V?V.querySelector(e):null}var Us=["em","strong","i","b"];function Gt(e){const t=[],s=new RegExp(`</?(?:${Us.join("|")})>`,"gi"),a=String(e).replace(s,i=>(t.push(i),`\0${t.length-1}\0`));let o=$(a);return o=o.replace(/\u0000(\d+)\u0000/g,(i,n)=>t[Number(n)]),o}function Ut(e){return e.replace(/\[([A-Za-z][A-Za-z ]{0,20}):\s*([^\]]+)\]/g,(t,s,a)=>`
        <span style="display:inline-block;margin:0.1rem 0.15rem 0.1rem 0;padding:0.05rem 0.45rem;background:var(--bg4);border-radius:10px;border-left:2px solid var(--gold);font-size:0.85em;">
            <strong style="color:var(--gold);">${s}:</strong> ${a}
        </span>
    `)}function Ft(e){return e.replace(/\*\*([^*]+)\*\*/g,"<strong>$1</strong>")}var Wt=["🌱","🏔️","👑","🤝","🌟","⏱️","♠️"];function Fs(e){return Wt.filter(t=>e.includes(t)).length>=3}function Ws(e){return e.split(/(?=(?:🌱|🏔️|👑|🤝|🌟|⏱️|♠️))/g).map(t=>t.trim()).filter(Boolean).map(t=>{const s=Wt.find(d=>t.startsWith(d)),a=s?t.slice(s.length).trim():t,o=a.indexOf(":");let i="",n=a;o>-1&&o<=25&&(i=a.slice(0,o).replace(/\*\*/g,"").trim(),n=a.slice(o+1).replace(/^\*\*\s*/,"").trim());const r=Ut(Ft(Gt(n))),c=s==="🌟"||s==="⏱️"||s==="♠️";return`
            <div style="padding:0.3rem 0.5rem;margin:0.2rem 0;border-radius:6px;background:${c?"var(--bg4)":"var(--bg2)"};border-left:2px solid ${c?"var(--gold)":"var(--border)"};">
                ${i?`<div style="font-weight:600;color:var(--gold);font-size:0.8rem;">${s||""} ${$(i)}</div>`:""}
                <div style="font-size:0.85rem;line-height:1.4;">${r}</div>
            </div>
        `}).join("")}function Ks(e,t=""){const s=String(e||"");if(!s)return"";if(t==="GM"||t==="System")return Gs(s);if(Fs(s))return Ws(s);const a=Ut(Ft(Gt(s))).split(/\n\s*\n/).map(o=>`<div style="margin:0.15rem 0;">${o.trim()}</div>`).join("");return Ts(a)}function Js(e){return{"Clean Success":"clean","Success with SB":"success_sb",Partial:"partial",Miss:"miss"}[e]||"unknown"}var kt=new Set,Ge=null,Ue=null;function Kt(){if(!V)return;const e=V.querySelector("#chatMessages");if(!e)return;const t=V.querySelector("#selected-character-display");t&&(Ue&&Ue(),Ue=m.subscribe("selectedCharacterId",s=>{const a=s?m.getSelectedCharacter():null;if(a){const o=a.avatar?`<img src="${a.avatar}" alt="${$(a.name)}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;border:2px solid var(--gold);" />`:'<span style="font-size:1.8rem;">🧑</span>';t.innerHTML=`
                    <div style="display:flex;align-items:center;gap:0.5rem;background:var(--bg3);padding:0.2rem 0.8rem;border-radius:20px;border:2px solid var(--gold);">
                        ${o}
                        <span style="font-weight:700;font-size:1rem;">${$(a.name)}</span>
                        <span style="font-size:0.7rem;color:var(--text2);">(selected)</span>
                        <button class="btn btn-xs btn-ghost" id="clear-selected-char" title="Deselect" style="padding:0 0.3rem;">✕</button>
                    </div>
                `;const i=t.querySelector("#clear-selected-char");i&&i.addEventListener("click",n=>{n.stopPropagation(),m.selectCharacter(null)})}else t.innerHTML='<span style="color:var(--text3);font-size:0.9rem;">No character selected</span>'})),Ge&&Ge(),Ge=m.subscribe("chatMessages",s=>{const a=s||[],o=D(),i=o?Ne():null,n=De?De():"websocket";for(const d of a){if(!d||!d.rollData||!d.id||kt.has(d.id))continue;const l=d.rollData,y=l.outcomeCode||Js(l.outcome);(y==="partial"||y==="miss")&&document.dispatchEvent(new CustomEvent("timer-tick-request",{detail:{amount:1,source:"roll",rollData:l,messageId:d.id}})),l.storyBeats&&l.storyBeats>0&&document.dispatchEvent(new CustomEvent("sb-generated",{detail:{count:l.storyBeats,source:"roll",rollData:l,messageId:d.id}})),kt.add(d.id)}if(!Array.isArray(a)||a.length===0){j(e,`
                <div class="empty-chat-state" style="padding:2rem 1rem;text-align:center;color:var(--text3);">
                    <div style="font-size:2.5rem;margin-bottom:0.5rem;">💬</div>
                    <div style="font-size:1.1rem;">No messages yet</div>
                    <div style="font-size:0.9rem;margin-top:0.3rem;">
                        ${o?`🌐 Connected to server${i?` (${i})`:""}`:"📡 Messages stay local"}
                        <span style="color:var(--text4);margin-left:0.3rem;">via ${n}</span>
                    </div>
                    <div style="font-size:0.8rem;margin-top:0.5rem;color:var(--text4);">
                        Type /help for commands
                    </div>
                </div>
            `);return}const r=a.length>me.maxChatMessages?a.slice(-me.maxChatMessages):a;let c="";for(const d of r){if(!d||typeof d!="object")continue;const l=d.sender||"Unknown",y=d.text||"",T=d.time||new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}),v=l===ke.SYSTEM||l===ke.ROLL,A=l===ke.OOC,w=l===ke.GM,C=l===ke.DECK,g=d.local!==!1;let h="var(--text)";v?h="var(--gold)":A?h="var(--blue)":w?h="var(--red)":C&&(h="var(--purple)");const I=d.whisper?"🔒 ":"",M=d.recipient&&d.recipient!=="all"?` → ${$(d.recipient)}`:"";let k="";g&&!o?k=' <span class="mode-badge local" style="font-size:0.65rem;color:var(--text3);background:var(--bg4);padding:0.05rem 0.5rem;border-radius:10px;margin-left:0.3rem;border:1px solid var(--border);">📡 local</span>':g&&o?k=' <span class="mode-badge local-ws" style="font-size:0.65rem;color:var(--gold);background:var(--bg4);padding:0.05rem 0.5rem;border-radius:10px;margin-left:0.3rem;border:1px solid var(--gold);">📡 local</span>':!g&&o&&(k=' <span class="mode-badge synced" style="font-size:0.65rem;color:var(--green);background:var(--bg4);padding:0.05rem 0.5rem;border-radius:10px;margin-left:0.3rem;border:1px solid var(--green);">🌐 synced</span>');let z="✓",P="var(--text3)",H="Local only";d.sent===!0?(z="✓✓",P="var(--green)",H="Synced to server"):d.sent===!1?(z="✗",P="var(--red)",H="Failed to send"):g?(z="✓",P="var(--text3)",H="Local only"):(z="✓✓",P="var(--green)",H="Synced to server"),c+=`
                <div class="chat-message" data-msg-id="${d.id||""}" style="padding:0.4rem 0.6rem;border-bottom:1px solid var(--border);font-size:1rem;transition:background 0.2s;">
                    <div style="display:flex;align-items:center;gap:0.4rem;flex-wrap:wrap;">
                        <span style="color:var(--text2);font-size:0.8rem;">${$(T)}</span>
                        <strong style="color:${h};font-size:1rem;">${$(l)}${M}:</strong>
                        <div style="word-break:break-word;font-size:1rem;flex:1 1 auto;min-width:0;">${I}${Ks(y,l)}</div>
                        ${k}
                        <span class="msg-status" style="font-size:0.7rem;color:${P};margin-left:auto;" title="${H}">${z}</span>
                    </div>
                    ${d.rollData?Ys(d.rollData):""}
                    ${d.deckData?Qs(d.deckData):""}
                </div>
            `}j(e,c),me.chatAutoScroll&&(e.scrollTop=e.scrollHeight)})}function Ys(e){if(!e)return"";const t=(e.dice||[]).map(o=>{let i="var(--bg4)",n="var(--text)",r=o;return o===10?(i="var(--green)",n="white",r="10"):o>=6?(i="var(--green)",n="white"):o===1&&(i="var(--red)",n="white",r="1⚠️"),`<span style="display:inline-block;padding:0.05rem 0.4rem;margin:0.05rem;border-radius:4px;background:${i};color:${n};font-size:0.8rem;">${r}</span>`}).join(" "),s=at(e.outcome||""),a=xs(e.outcome||"");return`
        <div style="margin-top:0.3rem;padding:0.3rem 0.5rem;background:var(--bg2);border-radius:6px;font-size:0.85rem;">
            <div style="display:flex;flex-wrap:wrap;gap:0.4rem;align-items:center;">
                <span class="outcome-tag ${Cs(e.outcome||"")}" style="padding:0.1rem 0.8rem;border-radius:20px;font-weight:700;background:${s};color:white;font-size:0.9rem;">${a}</span>
                <span>🎲 ${t}</span>
                <span style="color:var(--text3);">S:${e.successes||0} SB:${e.storyBeats||0}</span>
            </div>
        </div>
    `}function Qs(e){return e?`
        <div style="margin-top:0.3rem;padding:0.3rem 0.5rem;background:var(--bg2);border-radius:6px;font-size:0.85rem;color:var(--text3);">
            <span>🃏 ${(e.cards||[]).map(t=>t.is_joker?"🃏 Joker":`${t.rank_name||t.rank} of ${t.suit_name||t.suit}`).join(", ")}</span>
            ${e.remaining!==void 0?`<span style="margin-left:0.5rem;">Remaining: ${e.remaining}</span>`:""}
        </div>
    `:""}var Fe=null,We=null;function ut(){if(!V)return;const e=V.querySelector("#vttCharGrid");if(!e)return;const t=V.querySelector("#vtt-char-detail");t&&(Fe&&Fe(),We&&We(),Fe=m.subscribe("characters",s=>{const a=s.filter(n=>n.vtt!==!1),o=m.getSelectedCharacterId();if(a.length===0){j(e,'<div style="text-align:center;padding:1.5rem;color:var(--text3);font-size:1.1rem;">👤 No VTT characters</div>'),j(t,"");return}let i='<div style="display:flex;flex-direction:column;gap:0.4rem;">';for(const n of a){const r=n.name||"Unnamed",c=n.harm||0,d=n.fatigue||0,l=n.boons||0,y=n.tier||1,T=n.id===o,v=n.avatar?`<img src="${n.avatar}" alt="${$(r)}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;border:2px solid ${T?"var(--gold)":"var(--border)"};flex-shrink:0;" />`:'<span style="font-size:1.6rem;flex-shrink:0;">🧑</span>';i+=`
                <div class="vtt-char-card" data-char-id="${n.id}" style="
                    display:flex;
                    align-items:center;
                    gap:0.8rem;
                    background:var(--bg3);
                    border-radius:var(--radius);
                    padding:0.4rem 0.8rem;
                    border:2px solid ${T?"var(--gold)":"var(--border)"};
                    box-shadow: ${T?"0 0 12px rgba(212,175,55,0.4)":"none"};
                    transition:all 0.2s;
                    cursor:pointer;
                ">
                    ${v}
                    <div style="display:flex;flex-direction:column;justify-content:center;flex:1;min-width:0;">
                        <div style="display:flex;align-items:center;gap:0.4rem;flex-wrap:wrap;">
                            <span style="font-weight:700;font-size:1rem;">${$(r)}</span>
                            <span style="font-size:0.65rem;color:var(--text3);background:var(--bg4);padding:0.05rem 0.5rem;border-radius:12px;">T${y}</span>
                            ${T?'<span style="font-size:0.65rem;color:var(--gold);font-weight:600;">👑 Selected</span>':""}
                        </div>
                        <div style="display:flex;gap:0.8rem;font-size:0.85rem;color:var(--text2);margin-top:0.1rem;">
                            <span>❤️ ${c}</span>
                            <span>⚡ ${d}</span>
                            <span>🎲 ${l}</span>
                        </div>
                    </div>
                </div>
            `}i+="</div>",j(e,i),e.querySelectorAll(".vtt-char-card").forEach(n=>{n.addEventListener("click",r=>{const c=n.dataset.charId;c&&(m.getSelectedCharacterId()===c?m.selectCharacter(null):m.selectCharacter(c))})})}),We=m.subscribe("selectedCharacterId",s=>{if(!s){j(t,"");return}const a=m.getSelectedCharacter();if(!a){j(t,"");return}const o=a.attributes||{},i=a.skills||{},n=a.talents||[],r=a.assets||[],c=a.followers||[],d=C=>{const g=C.toLowerCase(),h=Object.keys(o).find(I=>I.toLowerCase()===g);return h?o[h]:1},l=["Body","Wits","Spirit","Presence"].map(C=>`
                <div style="
                    display:flex;
                    flex-direction:column;
                    align-items:center;
                    background:var(--bg3);
                    border-radius:6px;
                    padding:0.3rem 0.6rem;
                    border:1px solid var(--border);
                    flex:1;
                ">
                    <span style="font-size:0.6rem;color:var(--text3);text-transform:uppercase;">${C}</span>
                    <span style="font-size:1.2rem;font-weight:700;color:var(--gold);">${d(C)}</span>
                </div>
            `).join("");let y="";if(Object.keys(i).length){const C=Object.entries(i).filter(([g,h])=>h>0).sort((g,h)=>h[1]-g[1]);C.length?y=`
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.2rem 0.8rem;font-size:0.75rem;">
                        ${C.map(([g,h])=>`
                            <div style="display:flex;justify-content:space-between;border-bottom:1px dotted var(--border);padding:0.05rem 0;">
                                <span>${$(g)}</span>
                                <span style="color:var(--gold);font-weight:600;">${h}</span>
                            </div>
                        `).join("")}
                    </div>
                `:y='<div style="color:var(--text3);font-size:0.75rem;">No skills ranked</div>'}else y='<div style="color:var(--text3);font-size:0.75rem;">No skills</div>';const T=(C,g)=>!C||C.length===0?"":`
                <div style="margin-top:0.4rem;">
                    <span style="font-weight:600;font-size:0.7rem;color:var(--text3);text-transform:uppercase;">${g}</span>
                    <div style="display:flex;flex-wrap:wrap;margin-top:0.2rem;">${C.map(h=>{const I=typeof h=="string"?h:h.name||"Unnamed";return`<span style="
                    display:inline-block;
                    background:var(--bg4);
                    border-radius:12px;
                    padding:0.05rem 0.5rem;
                    font-size:0.7rem;
                    margin:0.1rem 0.2rem 0.1rem 0;
                    border:1px solid var(--border);
                    color:var(--text2);
                ">${$(I)}</span>`}).join("")}</div>
                </div>
            `;let v="";c&&c.length&&(v=`
                <div style="margin-top:0.4rem;">
                    <span style="font-weight:600;font-size:0.7rem;color:var(--text3);text-transform:uppercase;">Followers</span>
                    <div style="display:flex;flex-wrap:wrap;margin-top:0.2rem;">${c.map(C=>{const g=C.name||"Unnamed";return`<button class="btn btn-xs btn-secondary vtt-follower-btn" 
                                data-char="${$(a.name)}" 
                                data-follower="${$(g)}"
                                style="
                                    display:inline-block;
                                    background:var(--bg4);
                                    border-radius:12px;
                                    padding:0.05rem 0.6rem;
                                    font-size:0.7rem;
                                    margin:0.1rem 0.2rem 0.1rem 0;
                                    border:1px solid var(--gold);
                                    color:var(--gold);
                                    cursor:pointer;
                                    transition:all 0.2s;
                                "
                                onmouseover="this.style.background='var(--gold)'; this.style.color='#1a1400';"
                                onmouseout="this.style.background='var(--bg4)'; this.style.color='var(--gold)';"
                            >💬 ${$(g)}</button>`}).join("")}</div>
                </div>
            `);let A=`
            <div style="
                margin-top:0.8rem;
                padding:0.8rem;
                background:var(--bg2);
                border-radius:var(--radius);
                border:1px solid var(--gold);
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            ">
                <!-- Header -->
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;border-bottom:2px solid var(--gold);padding-bottom:0.3rem;">
                    <div>
                        <span style="font-size:1.2rem;font-weight:700;color:var(--gold);">${$(a.name)}</span>
                        <span style="font-size:0.7rem;color:var(--text3);background:var(--bg4);padding:0.05rem 0.5rem;border-radius:12px;margin-left:0.5rem;">Tier ${a.tier||1}</span>
                    </div>
                    <button class="btn btn-xs btn-ghost" id="vtt-close-detail" style="font-size:1rem;padding:0.1rem 0.4rem;">✕</button>
                </div>

                <!-- Attributes -->
                <div style="display:flex;gap:0.3rem;margin-bottom:0.5rem;">
                    ${l}
                </div>

                <!-- Skills -->
                <div style="margin-top:0.3rem;">
                    <div style="font-weight:600;font-size:0.7rem;color:var(--text3);text-transform:uppercase;margin-bottom:0.2rem;">Skills</div>
                    ${y}
                </div>

                <!-- Talents & Assets -->
                ${T(n,"Talents")}
                ${T(r,"Assets")}

                <!-- Followers -->
                ${v}
            </div>
        `;j(t,A);const w=t.querySelector("#vtt-close-detail");w&&w.addEventListener("click",()=>{m.selectCharacter(null)}),t.querySelectorAll(".vtt-follower-btn").forEach(C=>{C.removeEventListener("click",xt),C.addEventListener("click",xt)})}))}function xt(e){const t=e.currentTarget,s=t.dataset.char,a=t.dataset.follower,o=window.prompt(`What does ${a} say?`,"");o&&o.trim()&&document.dispatchEvent(new CustomEvent("follower-chat",{detail:{characterName:s,followerName:a,message:o.trim()}}))}var Ct=null;function Zs(e){if(!e)return;const t=f("#vtt-attr"),s=f("#vtt-skill"),a=f("#vtt-boons");t&&(t.value=e.body??3),s&&(s.value=0),a&&(a.value=e.boons??0)}function Xs(){Ct||(Ct=m.subscribe("selectedCharacterId",e=>{const t=e?m.getSelectedCharacter():null;t&&Zs(t)}))}var Ke=null;function Jt(){if(!V)return;const e=V.querySelector("#vtt-common-rolls");e&&(Xs(),Ke&&Ke(),Ke=m.subscribe("selectedCharacterId",t=>{const s=t?m.getSelectedCharacter():null;if(!s){j(e,'<span style="color:var(--text3);font-size:0.9rem;">Select a character to use common rolls.</span>');return}let a='<div style="display:flex;flex-wrap:wrap;gap:0.4rem;margin-top:0.4rem;">';for(const[o,i]of Object.entries(Os)){const n=s[i.attr]??3,r=s.skills?.[i.skill]??0;a+=`
                <button class="btn btn-sm btn-secondary common-roll-btn" 
                        data-attr="${n}" 
                        data-skill="${r}"
                        data-label="${o}"
                        style="font-size:0.8rem;padding:0.1rem 0.6rem;">
                    ${o} (${n}+${r})
                </button>
            `}a+="</div>",j(e,a),e.querySelectorAll(".common-roll-btn").forEach(o=>{o.addEventListener("click",()=>{const i=parseInt(o.dataset.attr,10)||3,n=parseInt(o.dataset.skill,10)||0,r=o.dataset.label,c=f("#vtt-attr"),d=f("#vtt-skill");c&&(c.value=i),d&&(d.value=n);const l=f("#vtt-boons");l&&s&&(l.value=s.boons||0);const y=f("#vtt-roll-output");y&&(y.innerHTML=`<span style="color:var(--text2);">⚡ ${r} prepared (Attr ${i} + Skill ${n})</span>`);const T=f(".vtt-panel:has(#vtt-roll-output)");T&&T.scrollIntoView({behavior:"smooth",block:"center"})})})}))}var Je=null;function Yt(){if(!V)return;const e=V.querySelector("#vttTimerList");e&&(Je&&Je(),Je=m.subscribe("timers",t=>{if(!t||t.length===0){j(e,'<div class="empty-state" style="text-align:center;padding:0.8rem;color:var(--text3);font-size:0.9rem;">⏱️ No active timers</div>');return}let s="";for(const a of t){const o=a.name||"Timer",i=a.current||0,n=a.segments||1,r=n>0?Math.min(i/n*100,100):0,c=r>=100;s+=`
                <div class="vtt-timer" style="margin-bottom:0.4rem;background:var(--bg3);border-radius:6px;padding:0.4rem 0.6rem;${c?"border:1px solid var(--red);":""}">
                    <div style="display:flex;justify-content:space-between;font-size:0.9rem;">
                        <span style="font-weight:600;">${$(o)}</span>
                        <span>${i}/${n} ${c?"✅":""}</span>
                    </div>
                    <div style="width:100%;height:6px;background:var(--bg4);border-radius:3px;margin-top:4px;overflow:hidden;">
                        <div style="width:${r}%;height:100%;background:${c?"var(--red)":"var(--gold)"};border-radius:3px;transition:width 0.3s;"></div>
                    </div>
                </div>
            `}j(e,s)}))}function Te(){if(!V)return;const e=V.querySelector("#presence-list");if(!e)return;let t=null,s=null;function a(){const o=m.state.presence||[],i=m.state.characters||[],n=D(),r=n?Ne():null,c=n?se():null,d=ht("fates-edge-show-avatars","true")!=="false";if(!o||o.length===0){j(e,`
                <details class="vtt-presence-details" style="margin-top:0.2rem;">
                    <summary style="cursor:pointer;font-weight:600;color:var(--text2);font-size:0.9rem;">👥 Party Members</summary>
                    <div style="color:var(--text3);padding:0.4rem 0;font-size:0.9rem;">
                        ${n?"🌐 Connected, no other players":"📡 Local mode"}
                        ${r?` (${r})`:""}
                    </div>
                </details>
            `);return}const l=c;let y="";for(const v of o){const A=v.id===l,w=v.online!==!1,C=v.name||"Unknown",g=v.role==="gm"?'<span style="font-size:0.55rem;background:var(--gold);color:#1a1400;padding:0.05rem 0.4rem;border-radius:8px;font-weight:600;">GM</span>':'<span style="font-size:0.55rem;background:var(--bg4);color:var(--text3);padding:0.05rem 0.4rem;border-radius:8px;">Player</span>',h=d?v.avatar||`https://ui-avatars.com/api/?name=${encodeURIComponent(C)}&size=32&background=2c3e50&color=fff`:"";let I="";const M=ht("fates-edge-remote-enabled","false")==="true";if(A){const k=v.selectedCharacter||"",z=Array.isArray(v.selectedCharacters)?v.selectedCharacters:k?[k]:[];if(i.length>0){const P=M?`<select class="vtt-char-select" multiple size="${Math.min(Math.max(i.length,2),6)}" data-client-id="${v.id}" title="Up to 6 characters (ctrl/cmd-click to select more than one)" style="font-size:0.75rem;padding:0.15rem;background:var(--bg3);border:1px solid var(--border);border-radius:4px;color:var(--text);max-width:140px;">
                                ${i.map(H=>`<option value="${$(H.name)}" ${z.includes(H.name)?"selected":""}>${$(H.name)}</option>`).join("")}
                            </select>`:`<select class="vtt-char-select" data-client-id="${v.id}" style="font-size:0.75rem;padding:0.05rem 0.3rem;background:var(--bg3);border:1px solid var(--border);border-radius:4px;color:var(--text);max-width:120px;">
                                <option value="">— Select —</option>
                                ${i.map(H=>`<option value="${$(H.name)}" ${H.name===k?"selected":""}>${$(H.name)}</option>`).join("")}
                            </select>`;I=`
                        <label style="display:flex;align-items:center;gap:0.2rem;font-size:0.65rem;color:var(--text3);white-space:nowrap;cursor:pointer;" title="Allow this client to control more than one character at once">
                            <input type="checkbox" class="vtt-remote-toggle" ${M?"checked":""} style="margin:0;" />
                            Remote
                        </label>
                        ${P}
                    `}else I=`
                        <span style="font-size:0.75rem;color:var(--text3);white-space:nowrap;">No characters</span>
                        <button class="btn btn-xs btn-primary" onclick="window.location.hash='characters'" style="font-size:0.6rem;padding:0.05rem 0.4rem;white-space:nowrap;">+ Create</button>
                    `}else{const k=Array.isArray(v.selectedCharacters)&&v.selectedCharacters.length>0?v.selectedCharacters:v.selectedCharacter?[v.selectedCharacter]:[];I=k.length>0?`<span style="font-size:0.75rem;color:var(--text2);white-space:nowrap;">🎭 ${$(k.join(", "))}</span>`:'<span style="font-size:0.75rem;color:var(--text3);white-space:nowrap;">No character selected</span>'}y+=`
                <div class="presence-item" style="display:flex;align-items:center;gap:0.6rem;padding:0.25rem 0;border-bottom:1px solid var(--border);${A?"background:var(--bg4);border-radius:6px;padding:0.25rem 0.6rem;":""}">
                    <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${w?"var(--green)":"var(--text3)"};flex-shrink:0;" title="${w?"Online":"Offline"}"></span>
                    ${d?`<img src="${h}" alt="${$(C)}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;flex-shrink:0;" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2232%22 height=%2232%22 viewBox=%220 0 32 32%22%3E%3Crect fill=%22%232c3e50%22 width=%2232%22 height=%2232%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.35em%22 fill=%22%23fff%22 font-family=%22Arial%22 font-size=%2214%22%3E${encodeURIComponent(C.charAt(0))}%3C/text%3E%3C/svg%3E'" />`:""}
                    <span style="font-weight:${A?"600":"400"};font-size:0.9rem;white-space:nowrap;">${$(C)}${A?" (you)":""}</span>
                    ${g}
                    <span style="flex:1;text-align:right;display:flex;justify-content:flex-end;align-items:center;gap:0.4rem;font-size:0.85rem;">
                        <span style="color:var(--text3);">Character:</span>
                        ${I}
                    </span>
                </div>
            `}const T=`
            <details class="vtt-presence-details" style="margin-top:0.2rem;" open>
                <summary style="cursor:pointer;font-weight:600;color:var(--text2);font-size:0.9rem;display:flex;align-items:center;gap:0.5rem;">
                    👥 Party Members
                    <span style="font-size:0.65rem;font-weight:400;color:var(--text3);">(${o.length} online)</span>
                </summary>
                <div style="margin-top:0.4rem;">
                    ${y}
                </div>
            </details>
        `;j(e,T),e.querySelectorAll(".vtt-char-select").forEach(v=>{v.removeEventListener("change",Tt),v.addEventListener("change",Tt)}),e.querySelectorAll(".vtt-remote-toggle").forEach(v=>{v.removeEventListener("change",St),v.addEventListener("change",St)})}t&&t(),s&&s(),t=m.subscribe("presence",a),s=m.subscribe("characters",a),a()}function Tt(e){const t=e.target;let s;t.multiple?(s=Array.from(t.selectedOptions).map(a=>a.value).filter(Boolean),s.length>6&&(u("You can only control up to 6 characters at once.","warning"),s=s.slice(0,6),Array.from(t.options).forEach(a=>{a.selected=s.includes(a.value)}))):s=t.value,window.__vttConnected&&window.__vttConnected.sendCharacterSelection?window.__vttConnected.sendCharacterSelection(s):B(()=>import("./vtt-connected.CtqHzPS-.js").then(a=>{a.sendCharacterSelection&&a.sendCharacterSelection(s)}),[])}function St(e){const t=!!e.target.checked;ks("fates-edge-remote-enabled",t?"true":"false"),m.setRemoteEnabled(t);const s=m.state.presence||[];m.updatePresence([...s])}var Ye=null;function Qt(){if(!V)return;const e=V.querySelector("#voice-clients-list"),t=V.querySelector("#voice-clients-count");!e||!t||(Ye&&Ye(),Ye=m.subscribe("voiceClients",s=>{if(t.textContent=`${s.length} voice user${s.length!==1?"s":""}`,!s||s.length===0){j(e,'<span style="color:var(--text3);font-size:0.85rem;">No other voice clients.</span>');return}let a="";for(const o of s){const i=o.speaking?"var(--gold)":"var(--bg3)",n=o.connectionState||"idle";let r="",c="var(--text3)",d="";switch(n){case"connected":r="🔗 Connected",c="var(--green)";break;case"connecting":r="⏳ Connecting...",c="var(--gold)";break;case"failed":r="❌ Failed",c="var(--red)";break;default:r="📡 Idle"}n!=="connected"&&n!=="connecting"?d=`<button class="btn btn-sm btn-primary voice-call-btn" data-client-id="${o.id}" style="font-size:0.7rem;padding:0.1rem 0.6rem;">📞 Call</button>`:n==="connected"&&(d='<span style="font-size:0.7rem;color:var(--green);">● Live</span>'),a+=`
                <span class="voice-client-badge" style="display:inline-flex;align-items:center;gap:0.4rem;padding:0.3rem 0.8rem;border-radius:20px;background:var(--bg4);font-size:0.85rem;border:1px solid var(--border);">
                    <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${i};transition:background 0.3s;" title="${i==="var(--gold)"?"Speaking":"Silent"}"></span>
                    <span style="font-weight:500;">${$(o.name)}</span>
                    <span style="font-size:0.7rem;color:${c};">${r}</span>
                    ${d}
                </span>
            `}j(e,a),e.querySelectorAll(".voice-call-btn").forEach(o=>{o.addEventListener("click",i=>{i.stopPropagation();const n=o.dataset.clientId,r=new CustomEvent("voice-call-request",{detail:{clientId:n}});document.dispatchEvent(r)})})}))}var Qe=null;function Zt(){if(!V)return;const e=V.querySelector("#message-count");e&&(Qe&&Qe(),Qe=m.subscribe("chatMessages",t=>{const s=t?t.length:0;e.textContent=`${s} message${s!==1?"s":""}`}))}function Oe(){const e=f("#chatRecipient");if(!e)return;j(e,"");const t=[{value:"all",label:"All"},{value:"gm",label:"GM"}],s=m.state.characters||[];for(const a of s)t.push({value:a.id||a.name.toLowerCase().replace(/\s+/g,"-"),label:a.name||"Unnamed"});for(const a of t){const o=document.createElement("option");o.value=a.value,o.textContent=a.label,e.appendChild(o)}}var Ze=null;function Mt(){try{Ze||(Ze=new(window.AudioContext||window.webkitAudioContext));const e=Ze,t=e.createOscillator(),s=e.createGain();t.connect(s),s.connect(e.destination),t.frequency.value=800,t.type="sine",s.gain.value=.1,t.start(),t.stop(e.currentTime+.1)}catch{}}var Et={melee:"body",unarmed:"body",brawl:"body",athletics:"body",ranged:"wits",tactics:"wits",command:"presence"},en=[{key:"melee",label:"Melee",icon:"⚔️"},{key:"ranged",label:"Ranged",icon:"🏹"},{key:"unarmed",label:"Unarmed",icon:"🥊"},{key:"brawl",label:"Brawl",icon:"🥊"}],tn={light:{close:2,near:1,label:"Light Weapon"},medium:{close:1,near:2,label:"Medium Weapon"},heavy:{close:-1,near:3,label:"Heavy Weapon"}},et=[{key:"close",label:"Close",color:"var(--red)",weaponKey:"close"},{key:"near",label:"Near",color:"var(--gold)",weaponKey:"near"},{key:"far",label:"Far",color:"var(--blue)",weaponKey:null},{key:"absent",label:"Absent",color:"var(--text3)",weaponKey:null}],Xt=[{id:"sidestep-strike",label:"Sidestep Strike",icon:"↪️",raw:!0,requires:e=>(e.melee||0)>=1,effect:"Move one range band as part of a melee attack; your Position worsens by one step.",skillKey:"melee",worsensPosition:!0},{id:"grapple",label:"Grapple",icon:"🤼",raw:!0,requires:e=>(e.melee||0)>=1||(e.athletics||0)>=1,effect:"Opposed Body+Melee vs. Body+Athletics. Target becomes Engaged and suffers -1 die until they break free.",skillKey:"melee"},{id:"aim",label:"Aim (Homebrew)",icon:"🎯",raw:!1,requires:e=>(e.ranged||0)>=1,effect:"Spend the action to steady your shot: +1 die on your next Ranged attack this scene, but you can't move first. Confirm with your GM — this is a table convenience, not an official rule.",skillKey:"ranged"}],xe=new Map;function es(e,t){return xe.get(e)?.get(t)||0}function sn(e,t){xe.has(e)||xe.set(e,new Map);const s=xe.get(e);s.set(t,(s.get(t)||0)+1)}function tt(){xe.clear(),u("⚔️ Combat Actions: per-scene talent uses reset.","info"),pt()}function Lt(e){if(!e)return 0;const t=String(e).match(/\+\s*(\d+)\s*(?:d\b|die|dice)/i);return t?parseInt(t[1],10):0}function ts(e){if(!e)return!1;const t=(e.category||"").toLowerCase();if(["combat","defense","movement","monk-unarmed","rogue-thief"].includes(t))return!0;const s=`${e.effect||""} ${e.description||""}`.toLowerCase();return/melee|ranged|weapon|attack|defense|harm\b|damage/.test(s)}function ss(e,t){const s=tn[e.weaponClass];if(!s||!t)return null;const a=s[t];return a===void 0?null:{bonus:a,label:s.label}}function _t({attrKey:e,effectiveSkill:t,boons:s}){const a=f("#vtt-attr"),o=f("#vtt-skill"),i=f("#vtt-boons"),n=m.getSelectedCharacter();a&&(a.value=n?n[e]??1:1),o&&(o.value=Math.max(0,t)),i&&s!==void 0&&(i.value=s)}function At(){const e=f("#vtt-roll-output")?.closest(".vtt-panel, .vtt-card");e&&e.scrollIntoView({behavior:"smooth",block:"center"})}function Rt(e){const t=f("#vtt-roll-output");t&&(t.innerHTML=`<span style="color:var(--text2);">⚡ ${$(e)}</span>`)}var Le=null;async function mt(){if(Le)return Le;try{return Le=await B(()=>import("./bestiary.CPB8-5uX.js").then(e=>e.a),__vite__mapDeps([0,1,2,3,4,5,6,7,8,9,10,11,12,13,14])),Le}catch{return null}}async function nn(e){const t=await mt();if(!t||typeof t.isTrackerOpen!="function")return[];try{return(typeof t.getLiveCombatants=="function"?t.getLiveCombatants():[]).filter(s=>(s.name||"").toLowerCase()!==(e||"").toLowerCase())}catch{return[]}}async function rn(e,t,s){const a=await mt();if(!a||typeof a.setTrackerRangeByName!="function")return!1;try{return a.setTrackerRangeByName(e,t,s)}catch{return!1}}var Y="",ne="near",Xe=null;function pt(){const e=f("#vtt-combat-actions");e&&(Xe&&Xe(),Xe=m.subscribe("selectedCharacterId",async t=>{const s=t?m.getSelectedCharacter():null;if(!s){e.innerHTML='<span style="color:var(--text3);font-size:0.9rem;">Select a character to see their combat options.</span>';return}await Re(e,s)}))}async function Re(e,t){const s=t.skills||{},a=(t.talents||[]).filter(ts),o=a.filter(v=>(v.activation||"passive")==="passive"),i=a.filter(v=>(v.activation||"passive")!=="passive"),n=await nn(t.name);n.some(v=>v.name===Y)||(Y=n[0]?.name||"");const r=n.length?n.map(v=>`<option value="${$(v.name)}" ${v.name===Y?"selected":""}>${$(v.name)}${v.position?` (${v.position})`:""}</option>`).join(""):`<option value="">No live targets (open GM's Combat Tracker to sync)</option>`,c=et.map(v=>`
        <button class="btn btn-xs combat-range-btn" data-range="${v.key}"
            style="background:${v.key===ne?v.color:"var(--bg4)"};color:${v.key===ne?"white":"var(--text2)"};border:none;">
            ${$(v.label)}
        </button>
    `).join(""),d=en.filter(v=>(s[v.key]||0)>0).map(v=>{const A=et.find(g=>g.key===ne),w=v.key==="melee"||v.key==="ranged"?ss(t,A?.weaponKey):null,C=w?` (${w.bonus>=0?"+":""}${w.bonus}d ${w.label})`:"";return`
                <button class="btn btn-sm btn-primary combat-attack-btn" data-skill="${v.key}"
                    style="font-size:0.85rem;">
                    ${v.icon} ${$(v.label)} Attack (${s[v.key]})${C}
                </button>
            `}).join(""),l=Xt.filter(v=>v.requires(s)).map(v=>`
            <button class="btn btn-sm btn-secondary combat-maneuver-btn" data-maneuver="${v.id}"
                title="${$(v.effect)}" style="font-size:0.8rem;">
                ${v.icon} ${$(v.label)}${v.raw?"":" 🛠️"}
            </button>
        `).join(""),y=o.map(v=>`
        <span class="badge" title="${$(v.effect||v.description||"")}"
            style="background:var(--bg4);color:var(--text2);font-size:0.7rem;padding:0.15rem 0.5rem;border-radius:10px;border:1px solid var(--border);">
            🔄 ${$(v.name)}
        </span>
    `).join(" "),T=i.map(v=>{const A=es(t.id,v.name),w=(v.useLimit||"custom")==="once-scene",C=w&&A>=1;return`
            <button class="btn btn-sm ${C?"":"btn-gold"} combat-talent-btn" data-talent="${$(v.name)}"
                ${C?"disabled":""} title="${$(v.effect||v.description||"")}"
                style="font-size:0.8rem;${C?"opacity:0.5;":""}">
                ⚡ ${$(v.name)} ${w?C?"(used)":"(1/scene)":""}
            </button>
        `}).join("");e.innerHTML=`
        <div style="display:flex;flex-direction:column;gap:0.6rem;">
            <div>
                <div style="font-size:0.7rem;color:var(--text3);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.25rem;">
                    📏 Range to target
                </div>
                <div style="display:flex;gap:0.3rem;flex-wrap:wrap;align-items:center;">
                    <select id="combat-target-select" style="font-size:0.8rem;padding:0.15rem 0.4rem;">${r}</select>
                    ${c}
                </div>
            </div>

            ${d?`
            <div>
                <div style="font-size:0.7rem;color:var(--text3);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.25rem;">⚔️ Attacks</div>
                <div style="display:flex;gap:0.3rem;flex-wrap:wrap;">${d}</div>
            </div>`:'<div style="color:var(--text3);font-size:0.8rem;">No combat skills purchased yet.</div>'}

            ${l?`
            <div>
                <div style="font-size:0.7rem;color:var(--text3);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.25rem;">🎯 Maneuvers</div>
                <div style="display:flex;gap:0.3rem;flex-wrap:wrap;">${l}</div>
            </div>`:""}

            ${T?`
            <div>
                <div style="font-size:0.7rem;color:var(--text3);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.25rem;">✨ Talents (active)</div>
                <div style="display:flex;gap:0.3rem;flex-wrap:wrap;">${T}</div>
            </div>`:""}

            ${y?`
            <div>
                <div style="font-size:0.7rem;color:var(--text3);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.25rem;">🔄 Talents (passive — always on)</div>
                <div style="display:flex;gap:0.3rem;flex-wrap:wrap;">${y}</div>
            </div>`:""}
        </div>
    `,an(e,t)}function an(e,t){const s=t.skills||{},a=(t.talents||[]).filter(ts),o=a.filter(i=>(i.activation||"passive")==="passive").reduce((i,n)=>i+Lt(n.effect||n.description),0);e.querySelector("#combat-target-select")?.addEventListener("change",i=>{Y=i.target.value}),e.querySelectorAll(".combat-range-btn").forEach(i=>{i.addEventListener("click",async()=>{if(ne=i.dataset.range,Y){const n=await rn(t.name,Y,ne);u(n?`📏 Range to ${Y} set to ${ne} (synced to GM Tracker).`:`📏 Range to ${Y} set to ${ne} (narrative only — GM Tracker not open/linked).`,"info")}await Re(e,t)})}),e.querySelectorAll(".combat-attack-btn").forEach(i=>{i.addEventListener("click",()=>{const n=i.dataset.skill,r=Et[n]||"body",c=et.find(y=>y.key===ne),d=n==="melee"||n==="ranged"?ss(t,c?.weaponKey):null,l=(s[n]||0)+(d?.bonus||0)+o;_t({attrKey:r,effectiveSkill:l,boons:t.boons??0}),Rt(`${n} attack prepared (${r} ${t[r]??1} + skill ${l}${Y?` vs ${Y}`:""})`),At()})}),e.querySelectorAll(".combat-maneuver-btn").forEach(i=>{i.addEventListener("click",async()=>{const n=Xt.find(r=>r.id===i.dataset.maneuver);if(n&&(_t({attrKey:Et[n.skillKey]||"body",effectiveSkill:(s[n.skillKey]||0)+o,boons:t.boons??0}),Rt(`${n.label} prepared — ${n.effect}`),At(),n.worsensPosition)){const r=(await mt())?.worsenTrackerPositionByName?.(t.name);r&&(u(`🧭 ${t.name}'s Position worsened to ${r} (synced to GM Tracker).`,"warning"),Re(e,t))}})}),e.querySelectorAll(".combat-talent-btn").forEach(i=>{i.addEventListener("click",()=>{const n=i.dataset.talent,r=a.find(d=>d.name===n);if(!r)return;if((r.useLimit||"custom")==="once-scene"&&es(t.id,n)>=1){u(`${n} has already been used this scene.`,"warning");return}sn(t.id,n);const c=Lt(r.effect||r.description);if(c>0){const d=f("#vtt-skill");d&&(d.value=(parseInt(d.value,10)||0)+c)}u(`⚡ ${n}: ${r.effect||r.description||"Activated."}`,"success"),Re(e,t)})})}var on=jt({default:()=>pn,destroy:()=>as,render:()=>rs,sendMessage:()=>G}),Q=null,X=!1,re=null,ve=[],st=[],pe=!1,be=null;async function It(){const e=f("#vtt-mini-tracker-body");if(e)try{const t=await B(()=>import("./bestiary.CPB8-5uX.js").then(r=>r.a),__vite__mapDeps([0,1,2,3,4,5,6,7,8,9,10,11,12,13,14])),{resolveObjectiveType:s,isCombatType:a}=await B(async()=>{const{resolveObjectiveType:r,isCombatType:c}=await import("./objective-types.CuiNbA6A.js").then(d=>d.a);return{resolveObjectiveType:r,isCombatType:c}},__vite__mapDeps([10,1])),o=t.getTrackerState();if(!o.combatants||o.combatants.length===0){e.innerHTML='<div class="text-muted text-sm">No active encounter. Open Encounters to start one.</div>';return}const i=m.getSelectedCharacter(),n=i?o.combatants.find(r=>(r.name||"").toLowerCase()===(i.name||"").toLowerCase()):null;e.innerHTML=`
      <div class="text-muted text-sm" style="margin-bottom:0.3rem;">Round ${o.round||0}</div>
      <div style="display:flex;flex-direction:column;gap:0.15rem;">
        ${o.combatants.map(r=>{const c=r.id===o.activeCombatantId,d={light:"🗡️",medium:"⚔️",heavy:"🔨",ranged:"🏹"}[r.weaponClass]||"";let l="";if(n&&n.id!==r.id){const A=t.getRangeBandBetween(n.id,r.id),w=t.getRangeBandInfo(A);l=`<span class="vtt-stat-pill" style="background:${w.color}22;border:1px solid ${w.color};color:${w.color};font-size:0.7rem;" title="Range to ${$(n.name)}">${w.short}</span>`}const y=a(r.objectiveType),T=s(r.objectiveType,r),v=r.harm>0?y?`<span class="text-muted text-sm" style="color:var(--red);" title="Harm">H${r.harm}</span>`:`<span class="text-muted text-sm" style="color:var(--orange);" title="${$(T.progressLabel)}">${T.icon}${r.harm}/${r.maxHarm}</span>`:"";return`
            <div style="display:flex;align-items:center;gap:0.4rem;padding:0.25rem 0.3rem;border-radius:4px;${c?"background:var(--bg4);border-left:2px solid var(--gold);":""}font-size:0.85rem;">
              <span style="flex:0 0 1.1rem;text-align:center;">${c?"▶":""}</span>
              <span style="flex:0 0 auto;color:${r.type==="player"?"var(--blue)":"var(--red)"};">${d}</span>
              <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${$(r.name)}</span>
              ${v}
              ${y&&r.fatigue>0?`<span class="text-muted text-sm" title="Fatigue">F${r.fatigue}</span>`:""}
              ${l}
            </div>
          `}).join("")}
      </div>
    `}catch(t){console.debug("[VTT Local] Mini tracker unavailable:",t?.message),e.innerHTML='<div class="text-muted text-sm">Combat tracker unavailable.</div>'}}function vt(){const e=m.getSelectedCharacter();if(e&&e.name)return e.name;const t=(m.state.characters||[]).find(s=>s.active!==!1);return t&&t.name?t.name:"Player"}function ln(e,t,s="all",a={}){return{text:e,sender:t,recipient:s,whisper:s!=="all",time:new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}),timestamp:Date.now(),local:!0,id:`msg_${Date.now()}_${Math.random().toString(36).substr(2,6)}`,sent:!1,...a}}function G(e,t,s="all",a={}){if(pe)return null;const o=ln(e,t,s,a);return m.addChatMessage(o),o}function Dt(e=!0){const t=f("#vtt-attr"),s=f("#vtt-skill"),a=f("#vtt-dv"),o=f("#vtt-pos"),i=f("#vtt-boons"),n=f("#vtt-attack-type"),r=f("#vtt-range"),c=f("#vtt-roll-output");if(!t||!s||!a||!o)return;let d=parseInt(t.value,10)||1;const l=parseInt(s.value,10)||0,y=parseInt(a.value,10)||3,T=o.value,v=parseInt(i?.value,10)||0,A=n?.value||"",w=r?.value||"";let C="",g=0;if(A&&w){const M=m.getSelectedCharacter(),k=qt({armorType:M?.armorType,range:w,weaponClass:A,shieldType:M?.shieldType},!0);g=k.diceBonus||0,d=Math.max(0,d+g),k.notes.length&&(C=` [${k.notes.join(", ")}]`)}const h=Pe(d,l,y,T,v);if(!h){u("Pool must be at least 1 die.","error");return}if(c){const M=h.dice.map(k=>{let z="var(--bg4)",P="var(--text)",H=k;return k===10?(z="var(--green)",P="white",H="10"):k>=6?(z="var(--green)",P="white"):k===1&&(z="var(--red)",P="white",H="1⚠️"),`<span class="vtt-roll-die" style="background:${z};color:${P};">${H}</span>`}).join("");c.innerHTML=`
      <div class="vtt-roll-result">
        <span class="outcome-tag ${h.outcomeClass}" style="display:inline-block;padding:0.15rem 0.8rem;border-radius:20px;font-weight:600;font-size:0.9rem;margin-right:0.4rem;background:${at(h.outcome)};">
          ${h.outcome}
        </span>
        <div class="vtt-roll-dice">${M}</div>
        <div class="vtt-roll-meta">
          <span>Successes: <strong style="color:var(--green);">${h.successes}</strong></span>
          <span>Story Beats: <strong style="color:var(--red);">${h.storyBeats}</strong></span>
          ${h.reRolls>0?`<span>Re-rolls: <strong>${h.reRolls}</strong></span>`:""}
          ${w?`<span>📏 <strong style="color:var(--gold);">${ze[w]||w}</strong>${C}</span>`:""}
          ${h.critical?`<span>💥 <strong style="color:#e91e63;">Critical (${h.tens}×10)</strong></span>`:h.tens>0?`<span style="color:var(--text3);">${h.tens}×10</span>`:""}
        </div>
      </div>
    `}const I=f("#vtt-post-chat");if(e&&I?.checked){const M=vt();let k=`[${h.outcome}] ${d}+${l} vs DV${y} (${T})`;w&&(k+=` @ ${ze[w]||w} range`),k+=" → ",k+=h.dice.join(" "),k+=` | S:${h.successes} SB:${h.storyBeats}`,h.critical&&(k+=` | 💥 CRIT (${h.tens}×10)`),k+=` — ${h.resultText}${C}`,G(k,M,"all",{rollData:{outcome:h.outcome,outcomeClass:h.outcomeClass,resultText:h.resultText,dice:h.dice,successes:h.successes,storyBeats:h.storyBeats,reRolls:h.reRolls,range:w||null,tens:h.tens,critical:h.critical}})}}function cn(e){const t=e.slice(1).trim().split(/\s+/),s=t[0].toLowerCase(),a=vt();switch(s){case"roll":{const o=parseInt(t[1],10)||3,i=parseInt(t[2],10)||0,n=parseInt(t[3],10)||3,r=t[4]||"controlled",c=parseInt(t[5],10)||0,d=t.slice(6).join(" ")||"",l=Pe(o,i,n,r,c);if(!l){u("Pool must be at least 1 die.","error");return}G(`[${l.outcome}] ${o}+${i} vs DV${n} (${r}) → ${l.dice.join(" ")} (S:${l.successes} SB:${l.storyBeats})${l.critical?" | 💥 CRIT":""}${d?" — "+d:""}`,a,"all",{rollData:{outcome:l.outcome,outcomeClass:l.outcomeClass,resultText:l.resultText,dice:l.dice,successes:l.successes,storyBeats:l.storyBeats,tens:l.tens,critical:l.critical}});break}case"timer":{const o=t.slice(1,t.length-1).join(" ")||"Scene Timer",i=parseInt(t[t.length-1],10)||4;B(()=>import("./state.42sFgcOQ.js").then(n=>n.A).then(n=>{const r=n.getState(),c={id:"timer-"+Date.now()+"-"+Math.random().toString(36).substr(2,4),name:o,segments:i,current:0};r.timers=r.timers||[],r.timers.push(c),m.updateTimers(r.timers),G(`Timer created: ${o} (${i} segments)`,"System","all"),u(`Timer "${o}" created.`,"success")}),__vite__mapDeps([3,1,2])).catch(n=>{u("Failed to create timer","error")});break}case"help":G(["📖 Commands:","/roll attr skill dv [pos] [boons] [note] - Make a roll","/timer name segments - Create a timer","/ooc text - Send out-of-character message","/status - Show party status","/clear - Clear chat","/help - Show this help","📡 Local mode (no server)"].join(`
`),"System","all");break;case"ooc":G(t.slice(1).join(" "),"OOC","all");break;case"status":{const o=F().filter(i=>i.vtt);o.length===0?G("📡 Local mode | No VTT characters.","System","all"):G(`📊 ${o.map(i=>`${i.name}: ❤️${i.harm||0} ⚡${i.fatigue||0} 🎲${i.boons||0}`).join(" | ")} | 📡 Local mode`,"System","all");break}case"clear":ot?.(),m.clearChat(),u("Chat cleared.","success");break;default:u("Unknown command. Try /help","error")}}async function dn(){if(!pe){if(X){Ee(),X=!1;const e=f("#vtt-voice-toggle");e&&(e.textContent="🎤 Voice Off",e.className="btn btn-sm");const t=f("#vtt-mute-toggle");t&&t.remove(),u("Voice chat disabled.","info")}else if(await it()){X=!0;const e=f("#vtt-voice-toggle");e&&(e.textContent="🎤 Voice On",e.className="btn btn-sm btn-primary");const t=f(".flex-between .flex:last-child");if(t&&!f("#vtt-mute-toggle")){const s=document.createElement("button");s.id="vtt-mute-toggle",s.className="btn btn-sm btn-green",s.textContent="🎙️ Live",s.addEventListener("click",ns),t.appendChild(s)}u("Voice chat enabled!","success")}un()}}function ns(){const e=lt(),t=f("#vtt-mute-toggle");t&&(e?(t.textContent="🔇 Muted",t.className="btn btn-sm btn-danger"):(t.textContent="🎙️ Live",t.className="btn btn-sm btn-green"))}function un(){if(!X)return;const e=je(),t=f("#vtt-mute-toggle");t&&(e.muted?(t.textContent="🔇 Muted",t.className="btn btn-sm btn-danger"):(t.textContent="🎙️ Live",t.className="btn btn-sm btn-green"))}function zt(){const e=f("#chatInput"),t=f("#chatRecipient");if(!e||!t)return;const s=e.value.trim();if(s){if(s.startsWith("/")){cn(s),e.value="";return}G(s,vt(),t.value),e.value="",e.focus()}}function mn(){if(pe)return;ve.forEach(({event:o,handler:i})=>{Q.removeEventListener(o,i)}),ve=[],ve=[{event:"click",handler:o=>{const i=o.target.closest("button, .btn, [id]");if(i)switch(i.id){case"chat-send-btn":o.preventDefault(),zt();break;case"vtt-clear-chat":ot?.(),m.clearChat(),u("Chat cleared.","success");break;case"vtt-refresh-btn":{const n=F();m.updateCharacters(n),m.updateTimers(O().timers||[]),u("VTT refreshed.","info");break}case"vtt-roll-post-btn":Dt(!0);break;case"vtt-roll-only-btn":Dt(!1);break;case"vtt-add-timer":{const n=prompt("Timer name:","Scene Timer");if(n){const r=parseInt(prompt("Segments:","6")||"6"),c=O(),d={id:"timer-"+Date.now()+"-"+Math.random().toString(36).substr(2,4),name:n,segments:r,current:0};c.timers=c.timers||[],c.timers.push(d),m.updateTimers(c.timers),G(`Timer created: ${n} (${r} segments)`,"System","all"),u(`Timer "${n}" created.`,"success")}break}case"vtt-scene-end":B(()=>import("./gm-tools.BcndmVEn.js").then(n=>n.n).then(n=>{typeof n.sceneEndTrimBoons=="function"&&n.sceneEndTrimBoons();const r=F();m.updateCharacters(r),tt()}),__vite__mapDeps([11,1,2,3,4,6,5,7,8,9,12,13,14])).catch(n=>{console.warn("[VTT Local] sceneEndTrimBoons unavailable, falling back to local trim:",n?.message),(O().characters||[]).forEach(r=>{r.boons=Math.min(r.boons||0,2)}),Ss(),m.updateCharacters(F()),tt(),u("Scene ended: Boons trimmed.","info")});break;case"vtt-voice-toggle":dn();break;case"vtt-mute-toggle":ns()}}},{event:"keydown",handler:o=>{o.key==="Enter"&&o.target.id==="chatInput"&&(o.preventDefault(),zt())}},{event:"change",handler:o=>{o.target.id==="vtt-auto-scroll"&&(me.chatAutoScroll=o.target.checked)}}],ve.forEach(({event:o,handler:i})=>{Q.addEventListener(o,i)});const a=o=>{const{characterName:i,followerName:n,message:r}=o.detail;!r||!n||G(r,`${n} (${i})`,"all")};document.addEventListener("follower-chat",a),st.push({event:"follower-chat",handler:a})}function rs(e){if(pe&&(pe=!1),Q=e,Be(e),!e)return;const t=ct();D();const s=je(),a=t.map(i=>{const n=qe(i),r=n?.speaking?"var(--gold)":"var(--bg3)",c=n?.name||"Player";return`<span class="voice-client-badge" style="display:inline-flex;align-items:center;gap:0.4rem;padding:0.2rem 0.8rem;border-radius:20px;background:var(--bg4);font-size:0.85rem;border:1px solid var(--border);">
      <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${r};transition:background 0.3s;"></span>
      ${$(c)}
    </span>`}).join("");e.innerHTML=`
  <div class="vtt-live-table">

    <!-- Header -->
    <div class="vtt-header">
      <h1 class="page-title">
        💬 VTT – Live Table
        <span class="mode-indicator vtt-stat-pill local">📡 Local</span>
        <button class="btn btn-sm btn-ghost" onclick="window.location.hash='whiteboard'" title="Open Whiteboard">✏️ Whiteboard</button>
      </h1>
      <p class="page-sub">Chat, party status, quick die roller, and scene timers all in one view.</p>
    </div>

    <!-- Table Status -->
    <div class="panel vtt-card status-panel">
      <div class="vtt-card-header">
        <span class="vtt-card-title">🛰️ Table Status</span>
        <span class="vtt-stat-pill">
          <span class="vtt-dot" style="background:var(--vtt-gold);"></span>
          📡 Local mode (no server)
        </span>
      </div>
      <div class="vtt-stat-row" style="justify-content:space-between;">
        <div class="vtt-btn-row" style="align-items:center;">
          <button class="btn btn-sm ${X?"btn-primary":""}" id="vtt-voice-toggle">${X?"🎤 Voice On":"🎤 Voice Off"}</button>
          ${X?`<button class="btn btn-sm ${s?.muted?"btn-danger":"btn-green"}" id="vtt-mute-toggle">${s?.muted?"🔇 Muted":"🎙️ Live"}</button>`:""}
          <span class="vtt-stat-pill" id="voice-clients-count">${t.length} voice users</span>
        </div>
      </div>
      <div id="voice-clients-list" style="display:flex;flex-wrap:wrap;gap:0.5rem;margin-top:0.5rem;">${a}</div>
      <div class="vtt-divider"></div>
      <div class="vtt-card-header" style="margin-bottom:0.35rem;">
        <span class="vtt-card-title" style="font-size:1rem;">👥 Party Members</span>
        <span class="vtt-stat-pill" id="vtt-mode-badge">📡 Local</span>
      </div>
      <div id="presence-list"></div>
    </div>

    <!-- Main Grid -->
    <div class="vtt-section-grid">
      <!-- Chat Column -->
      <div class="chat-box vtt-card" style="display:flex;flex-direction:column;min-height:min(55vh, 500px);">
        <div class="vtt-card-header">
          <span class="vtt-card-title">💬 Chat</span>
          <div class="vtt-btn-row" style="align-items:center;">
            <span class="text-muted" id="message-count">0 messages</span>
            <button class="btn btn-sm btn-ghost" id="vtt-clear-chat" title="Clear chat">🗑️</button>
          </div>
        </div>
        <!-- Viewport-relative sizing so short/mobile viewports don't force a
             fixed 300-600px box that overflows the page; scales with vh,
             capped so huge desktop monitors don't get an absurdly tall pane. -->
        <div class="chat-messages" id="chatMessages" style="flex:1;overflow-y:auto;padding:0.5rem;background:var(--vtt-surface2);border-radius:calc(var(--vtt-radius) - 2px);margin-bottom:0.5rem;font-size:1rem;display:flex;flex-direction:column;max-height:min(70vh, 600px);min-height:min(35vh, 300px);"></div>
        <div id="selected-character-display" style="margin-bottom:0.4rem;padding:0.2rem 0.4rem;background:var(--vtt-surface2);border-radius:calc(var(--vtt-radius) - 2px);min-height:2.5rem;"></div>
        <div class="chat-input-row" style="display:flex;gap:0.4rem;">
          <input type="text" id="chatInput" placeholder="Type… (/roll, /timer, /help)" style="flex:1;font-size:1rem;padding:0.5rem 0.6rem;" />
          <select id="chatRecipient" style="flex:0 0 120px;font-size:1rem;">
            <option value="all">All</option>
          </select>
          <button class="btn btn-gold" id="chat-send-btn">Send</button>
        </div>
        <div class="flex mt-1" style="flex-wrap:wrap;gap:0.9rem;font-size:0.9rem;align-items:center;">
          <label class="inline-check"><input type="checkbox" id="vtt-post-chat" checked /> Post rolls to chat</label>
          <label class="inline-check"><input type="checkbox" id="vtt-auto-scroll" checked /> Auto-scroll</label>
        </div>
        <div class="vtt-hint">Try <code>/roll 3 2 3</code> or <code>/help</code> for the full command list.</div>
      </div>

      <!-- Sidebar -->
      <div class="vtt-sidebar">
        <div class="vtt-sidebar-scroll">
          <!-- Party -->
          <div class="vtt-panel vtt-card">
            <div class="vtt-card-header">
              <span class="vtt-card-title" style="font-size:1.05rem;">👥 Party</span>
              <button class="btn btn-sm btn-ghost" id="vtt-refresh-btn" title="Refresh">↻</button>
            </div>
            <div id="vttCharGrid" class="vtt-char-grid"></div>
            <!-- NEW: detail panel for selected character (TTRPG sheet) -->
            <div id="vtt-char-detail" style="margin-top:0.5rem;"></div>
          </div>

          <!-- Combat Actions -->
          <div class="vtt-panel vtt-card">
            <div class="vtt-card-header">
              <span class="vtt-card-title" style="font-size:1.05rem;">⚔️ Combat Actions</span>
            </div>
            <div id="vtt-combat-actions" style="min-height:2.5rem;"></div>
          </div>

          <!-- Mini Combat Tracker — live initiative order + range-to-you,
               without requiring the full Encounters tracker modal open.
               Reads encounters/combat.js's in-memory session (see
               getTrackerState() there); safe no-op if none is active. -->
          <div class="vtt-panel vtt-card">
            <div class="vtt-card-header">
              <span class="vtt-card-title" style="font-size:1.05rem;">🗡️ Combat Tracker</span>
              <button class="btn btn-sm btn-ghost" onclick="window.location.hash='encounters'" title="Open full Encounters tracker">↗️</button>
            </div>
            <div id="vtt-mini-tracker-body" style="min-height:2rem;"></div>
          </div>

          <!-- Quick Roller -->
          <div class="vtt-panel vtt-card">
            <div class="vtt-card-header">
              <span class="vtt-card-title" style="font-size:1.05rem;">🎲 Quick Roller</span>
            </div>
            <div class="vtt-dice-row">
              <div class="vtt-field">
                <label>Attr</label>
                <input type="number" id="vtt-attr" value="3" min="1" max="8" style="width:100%;" />
              </div>
              <div class="vtt-field">
                <label>Skill</label>
                <input type="number" id="vtt-skill" value="2" min="0" max="12" style="width:100%;" />
              </div>
              <div class="vtt-field" style="flex:0 0 80px;">
                <label>DV</label>
                <select id="vtt-dv">
                  <option value="2">2</option><option value="3" selected>3</option><option value="4">4</option><option value="5">5+</option>
                </select>
              </div>
              <div class="vtt-field" style="flex:0 0 90px;">
                <label>Pos</label>
                <select id="vtt-pos">
                  <option value="dominant">Dom</option><option value="controlled" selected>Ctrl</option><option value="desperate">Desp</option>
                </select>
              </div>
              <div class="vtt-field" style="flex:0 0 70px;">
                <label>Boons</label>
                <input type="number" id="vtt-boons" value="0" min="0" max="5" />
              </div>
            </div>
            <div class="vtt-dice-row" style="margin-top:0.4rem;">
              <div class="vtt-field" style="flex:1 1 140px;">
                <label>Weapon</label>
                <select id="vtt-attack-type" title="Weapon weight class — drives the range bonus below (Player's Guide §3.12.1-3.12.3).">
                  <option value="">— N/A —</option>
                  <option value="light">🗡️ Light</option>
                  <option value="medium">⚔️ Medium</option>
                  <option value="heavy">🔨 Heavy</option>
                  <option value="ranged">🏹 Ranged</option>
                </select>
              </div>
              <div class="vtt-field" style="flex:1 1 160px;">
                <label>Range (GM-set)</label>
                <select id="vtt-range" title="The narrative range the GM told you before rolling.">
                  ${Bt.map(i=>`<option value="${i.key}">${i.label}</option>`).join("")}
                </select>
              </div>
            </div>
            <div id="vtt-common-rolls" style="margin-top:0.5rem;min-height:2.5rem;"></div>
            <div class="vtt-btn-row" style="margin-top:0.5rem;">
              <button class="btn btn-gold btn-sm" id="vtt-roll-post-btn">Roll &amp; Post</button>
              <button class="btn btn-sm" id="vtt-roll-only-btn">Roll Only</button>
            </div>
            <div id="vtt-roll-output" class="mt-1" style="min-height:3rem;padding:0.2rem 0;"></div>
          </div>

          <!-- Timers -->
          <div class="vtt-panel vtt-card">
            <div class="vtt-card-header">
              <span class="vtt-card-title" style="font-size:1.05rem;">⏱️ Scene Timers</span>
            </div>
            <div id="vttTimerList"></div>
            <div class="vtt-btn-row" style="margin-top:0.5rem;">
              <button class="btn btn-sm" id="vtt-add-timer">+ Add Timer</button>
              <button class="btn btn-sm" id="vtt-scene-end">🌅 Scene End</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
`,Kt(),ut(),Jt(),pt(),Yt(),Te(),Qt(),Zt(),Oe(),It();const o=F();m.updateCharacters(o),m.updateTimers(O().timers||[]),m.setConnectionStatus("local"),be&&be(),be=dt(i=>{m.updateVoiceClients(i)}),mn(),re&&clearInterval(re),re=setInterval(()=>{if(pe||!Q){clearInterval(re),re=null;return}const i=F();m.updateCharacters(i),m.updateTimers(O().timers||[]),It()},me.presenceUpdateInterval),console.log("[VTT Local] Rendered with reactive store (JRPG style + selection + detail panel)")}function as(){pe=!0,re&&(clearInterval(re),re=null),Q&&(ve.forEach(({event:e,handler:t})=>{Q.removeEventListener(e,t)}),ve=[],Q.innerHTML="",Be(null),Q=null),st.forEach(({event:e,handler:t})=>{document.removeEventListener(e,t)}),st=[],be&&(be(),be=null),X&&(Ee(),X=!1),console.log("[VTT Local] Destroyed")}var pn={render:rs,destroy:as,sendMessage:G,getContainer:()=>Q},vn=jt({default:()=>En,destroy:()=>bs,render:()=>gs,sendCharacterSelection:()=>Se,sendMessage:()=>J}),Z=null,ee=!1,L=new Map,fe=[],ge=[],x=!1,he=null,ae=null,oe=null,ye=null,$e=null,q={cards:[],history:[],offset:0,remaining:54},U="Acasia",we=[],_={currentGmId:null,currentGmName:null,requests:[],myRole:"player"},te=new Map,de=!1,nt=null,rt=null;function ft(){return localStorage.getItem("fates-edge-client-name")||"Player"}function fn(){return localStorage.getItem("fates-edge-client-role")||"player"}function os(){if(!D())return;const e=ft(),t=fn();Ce({type:"presence",name:e,role:t})}function Se(e){if(!D())return;const t=se();if(!t)return;const s=(Array.isArray(e)?e:[e]).filter(Boolean).slice(0,6);Ce({type:"character-select",clientId:t,characters:s,character:s[0]||""});const a=(m.state.presence||[]).map(n=>n.id===t?{...n,selectedCharacter:s[0]||"",selectedCharacters:s}:n);m.updatePresence(a);const o=m.state.characters||[],i=s.map(n=>o.find(r=>r.name===n)?.id).filter(Boolean);m.setSelectedCharacterIds(i)}async function Ht(){const e=f("#vtt-mini-tracker-body");if(e)try{const t=await B(()=>import("./bestiary.CPB8-5uX.js").then(r=>r.a),__vite__mapDeps([0,1,2,3,4,5,6,7,8,9,10,11,12,13,14])),{resolveObjectiveType:s,isCombatType:a}=await B(async()=>{const{resolveObjectiveType:r,isCombatType:c}=await import("./objective-types.CuiNbA6A.js").then(d=>d.a);return{resolveObjectiveType:r,isCombatType:c}},__vite__mapDeps([10,1])),o=t.getTrackerState();if(!o.combatants||o.combatants.length===0){e.innerHTML='<div class="text-muted text-sm">No active encounter. Open Encounters to start one.</div>';return}const i=m.getSelectedCharacter(),n=i?o.combatants.find(r=>(r.name||"").toLowerCase()===(i.name||"").toLowerCase()):null;e.innerHTML=`
            <div class="text-muted text-sm" style="margin-bottom:0.3rem;">Round ${o.round||0}</div>
            <div style="display:flex;flex-direction:column;gap:0.15rem;">
                ${o.combatants.map(r=>{const c=r.id===o.activeCombatantId,d={light:"🗡️",medium:"⚔️",heavy:"🔨",ranged:"🏹"}[r.weaponClass]||"";let l="";if(n&&n.id!==r.id){const A=t.getRangeBandBetween(n.id,r.id),w=t.getRangeBandInfo(A);l=`<span class="vtt-stat-pill" style="background:${w.color}22;border:1px solid ${w.color};color:${w.color};font-size:0.7rem;" title="Range to ${$(n.name)}">${w.short}</span>`}const y=a(r.objectiveType),T=s(r.objectiveType,r),v=r.harm>0?y?`<span class="text-muted text-sm" style="color:var(--red);" title="Harm">H${r.harm}</span>`:`<span class="text-muted text-sm" style="color:var(--orange);" title="${$(T.progressLabel)}">${T.icon}${r.harm}/${r.maxHarm}</span>`:"";return`
                        <div style="display:flex;align-items:center;gap:0.4rem;padding:0.25rem 0.3rem;border-radius:4px;${c?"background:var(--bg4);border-left:2px solid var(--gold);":""}font-size:0.85rem;">
                            <span style="flex:0 0 1.1rem;text-align:center;">${c?"▶":""}</span>
                            <span style="flex:0 0 auto;color:${r.type==="player"?"var(--blue)":"var(--red)"};">${d}</span>
                            <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${$(r.name)}</span>
                            ${v}
                            ${y&&r.fatigue>0?`<span class="text-muted text-sm" title="Fatigue">F${r.fatigue}</span>`:""}
                            ${l}
                        </div>
                    `}).join("")}
            </div>
        `}catch(t){console.debug("[VTT Connected] Mini tracker unavailable:",t?.message),e.innerHTML='<div class="text-muted text-sm">Combat tracker unavailable.</div>'}}function gt(){const e=m.getSelectedCharacter();if(e&&e.name)return e.name;const t=(m.state.characters||[]).find(s=>s.active!==!1);return t&&t.name?t.name:"Player"}function gn(e,t,s="all",a={}){const o=D();return{text:e,sender:t,recipient:s,whisper:s!=="all",time:new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}),timestamp:Date.now(),local:!o,id:`msg_${Date.now()}_${Math.random().toString(36).substr(2,6)}`,sent:!1,...a}}function J(e,t,s="all",a={}){if(x)return null;const o=D(),i=gn(e,t,s,a);if(m.addChatMessage(i),!i.whisper)try{Ms({type:"chat_message",sender:t,recipient:s,text:e.substring(0,100)})}catch{}if(o)try{As(i),setTimeout(()=>{const n=f(`[data-msg-id="${i.id}"]`);if(n){const r=n.querySelector(".msg-status");r&&(r.textContent="✓✓",r.style.color="var(--green)",r.title="Synced to server")}},500)}catch(n){console.warn("[VTT Connected] Failed to send via WebSocket:",n),u("Message failed to send. Check connection.","error");const r=f(`[data-msg-id="${i.id}"]`);if(r){const c=r.querySelector(".msg-status");c&&(c.textContent="✗",c.style.color="var(--red)",c.title="Failed to send")}}return i}var He=null;function is(e,t="System",s={}){if(!He)return console.warn("[VTT] Not initialized – message not sent."),!1;const{isHTML:a=!1,recipient:o="all",metadata:i={}}=s;return a&&t!=="System"&&t!=="GM"?(console.warn("[VTT] HTML messages only allowed for System or GM senders."),!1):(He(e,t,o,i),!0)}window.sendToVTT=is;async function Ie(e=1,t=null){if(x)return;const s=D(),a=t||U;if(s)try{const o=await Vs(e,a);o&&o.error?u(`Deck draw failed: ${o.error}`,"error"):(u(`🃏 Drew ${e} card${e>1?"s":""} from ${a}`,"success"),o&&o.remaining!==void 0&&(q.remaining=o.remaining,ie()))}catch(o){console.warn("[VTT Connected] Failed to send deck draw:",o),u("Deck draw failed. Check connection.","error")}else{const o=hn(e).map(i=>`${i.rankName} of ${i.suitName}`).join(", ");J(`🃏 Drew ${e} card${e>1?"s":""}: ${o}`,"Deck","all"),q.remaining=Math.max(0,q.remaining-e),ie()}}async function ls(e=null){if(x)return;const t=D(),s=e||U;if(t)try{const a=await Ds(s);a&&a.error?u(`Crown Spread failed: ${a.error}`,"error"):(u(`👑 Crown Spread from ${s}`,"success"),a&&a.remaining!==void 0&&(q.remaining=a.remaining,ie()))}catch(a){console.warn("[VTT Connected] Failed to send Crown Spread:",a),u("Crown Spread failed. Check connection.","error")}else u("Crown Spread requires server connection.","error")}async function cs(){if(!x)if(D())try{const e=await Ps();e&&e.error?u(`Shuffle failed: ${e.error}`,"error"):(u("🔀 Deck shuffled.","success"),e&&e.remaining!==void 0&&(q.remaining=e.remaining,ie()))}catch(e){console.warn("[VTT Connected] Failed to shuffle deck:",e),u("Deck shuffle failed.","error")}else u("Deck shuffle requires server connection.","error")}async function ds(){if(!x)if(D())try{const e=await Ns();if(e&&e.error)u(`History failed: ${e.error}`,"error");else if(e&&e.history){const t=e.history;if(t.length===0)u("📜 No deck history available.","info");else{const s=t.slice(-5).map(a=>`${a.type}: ${a.cards}`).join(`
`);u(`📜 Recent draws:
${s}`,"info")}}}catch(e){console.warn("[VTT Connected] Failed to get deck history:",e),u("Failed to get deck history.","error")}else u("Deck history requires server connection.","error")}async function bn(){if(!x)if(D())try{const e=await qs();e&&e.error?u(`Clear history failed: ${e.error}`,"error"):u("🗑️ Deck history cleared.","success")}catch(e){console.warn("[VTT Connected] Failed to clear deck history:",e),u("Failed to clear deck history.","error")}else u("Clear history requires server connection.","error")}function ie(){const e=f("#vtt-deck-count");e&&(e.textContent=String(q.remaining||0));const t=f("#vtt-deck-count-header");t&&(t.textContent=String(q.remaining||0))}function hn(e){const t=["hearts","spades","clubs","diamonds"],s=["A","2","3","4","5","6","7","8","9","10","J","Q","K"],a={A:"Ace",K:"King",Q:"Queen",J:"Jack"},o={hearts:"Hearts",spades:"Spades",clubs:"Clubs",diamonds:"Diamonds"},i=[];for(const n of t)for(const r of s)i.push({suit:n,rank:r,rankName:a[r]||r,suitName:o[n]});for(let n=i.length-1;n>0;n--){const r=Math.floor(Math.random()*(n+1));[i[n],i[r]]=[i[r],i[n]]}return i.slice(0,e)}async function us(){if(!x)if(D())try{const e=await Hs();if(e&&e.error)u(`List modules failed: ${e.error}`,"error");else if(e&&e.modules){we=e.modules;const t=we.length;if(t===0)u("📦 No modules loaded.","info");else{const s=we.map(a=>a.name||a.id).join(", ");u(`📦 ${t} module${t>1?"s":""} loaded: ${s}`,"info")}}}catch(e){console.warn("[VTT Connected] Failed to list modules:",e),u("Failed to list modules.","error")}else u("Module list requires server connection.","error")}async function yn(e){if(!x)if(D())try{const t=await Bs(e);if(t&&t.error){u(`Module push failed: ${t.error}`,"error");return}u(`📦 Module pushed: ${e}`,"success");const s=t?.module?.files&&t.module.files["adventure.json"];if(s)try{const a=JSON.parse(s);(await B(()=>import("./adventure-manager.BYGz956n.js"),__vite__mapDeps([15,2,3,1,4,6,5,7,8,9,10,11,12,13,14,0]))).installAdventureContent(a,{sourceLabel:"📦 Module installed"})}catch(a){console.warn("[VTT Connected] Pushed module could not be auto-installed locally:",a)}}catch(t){console.warn("[VTT Connected] Failed to push module:",t),u("Module push failed.","error")}else u("Module push requires server connection.","error")}async function $n(e){if(!x)if(D())try{const t=await zs(e);t&&t.error?u(`Module cleanup failed: ${t.error}`,"error"):u(`🧹 Module cleanup: ${e}`,"success")}catch(t){console.warn("[VTT Connected] Failed to cleanup module:",t),u("Module cleanup failed.","error")}else u("Module cleanup requires server connection.","error")}function Vt(e=!0){const t=f("#vtt-attr"),s=f("#vtt-skill"),a=f("#vtt-dv"),o=f("#vtt-pos"),i=f("#vtt-boons"),n=f("#vtt-attack-type"),r=f("#vtt-range"),c=f("#vtt-roll-output");if(!t||!s||!a||!o)return;let d=parseInt(t.value,10)||1;const l=parseInt(s.value,10)||0,y=parseInt(a.value,10)||3,T=o.value,v=parseInt(i?.value,10)||0,A=n?.value||"",w=r?.value||"";let C="";if(A&&w){const I=m.getSelectedCharacter(),M=qt({armorType:I?.armorType,range:w,weaponClass:A,shieldType:I?.shieldType},!0);d=Math.max(0,d+(M.diceBonus||0)),M.notes.length&&(C=` [${M.notes.join(", ")}]`)}const g=Pe(d,l,y,T,v);if(!g){u("Pool must be at least 1 die.","error");return}if(c){const I=g.dice.map(M=>{let k="var(--bg4)",z="var(--text)",P=M;return M===10?(k="var(--green)",z="white",P="10"):M>=6?(k="var(--green)",z="white"):M===1&&(k="var(--red)",z="white",P="1⚠️"),`<span class="vtt-roll-die" style="background:${k};color:${z};">${P}</span>`}).join("");c.innerHTML=`
            <div class="vtt-roll-result">
                <span class="outcome-tag ${g.outcomeClass}" style="display:inline-block;padding:0.15rem 0.8rem;border-radius:20px;font-weight:600;font-size:0.9rem;margin-right:0.4rem;background:${at(g.outcome)};">
                    ${g.outcome}
                </span>
                <div class="vtt-roll-dice">${I}</div>
                <div class="vtt-roll-meta">
                    <span>Successes: <strong style="color:var(--green);">${g.successes}</strong></span>
                    <span>Story Beats: <strong style="color:var(--red);">${g.storyBeats}</strong></span>
                    ${g.reRolls>0?`<span>Re-rolls: <strong>${g.reRolls}</strong></span>`:""}
                    ${w?`<span>📏 <strong style="color:var(--gold);">${ze[w]||w}</strong>${C}</span>`:""}
                    ${g.critical?`<span>💥 <strong style="color:#e91e63;">Critical (${g.tens}×10)</strong></span>`:g.tens>0?`<span style="color:var(--text3);">${g.tens}×10</span>`:""}
                </div>
            </div>
        `}const h=f("#vtt-post-chat");if(e&&h?.checked){const I=gt();let M=`[${g.outcome}] ${d}+${l} vs DV${y} (${T})`;if(w&&(M+=` @ ${ze[w]||w} range`),M+=" → ",M+=g.dice.join(" "),M+=` | S:${g.successes} SB:${g.storyBeats}`,g.reRolls>0&&(M+=` | Re-rolls: ${g.reRolledDice.map(k=>`${k.old}→${k.new}`).join(", ")}`),g.critical&&(M+=` | 💥 CRIT (${g.tens}×10)`),M+=` — ${g.resultText}${C}`,J(M,I,"all",{rollData:{outcome:g.outcome,outcomeClass:g.outcomeClass,resultText:g.resultText,dice:g.dice,successes:g.successes,storyBeats:g.storyBeats,reRolls:g.reRolls,reRolledDice:g.reRolledDice,range:w||null,tens:g.tens,critical:g.critical}}),D())try{Rs({...g,sender:I,timestamp:Date.now()})}catch{}B(()=>import("./bestiary.CPB8-5uX.js").then(k=>k.a).then(k=>{k.logExternalAction?.(I,M,"roll")}),__vite__mapDeps([0,1,2,3,4,5,6,7,8,9,10,11,12,13,14])).catch(()=>{})}}function wn(e){const t=e.slice(1).trim().split(/\s+/),s=t[0].toLowerCase(),a=gt();switch(s){case"roll":{const o=parseInt(t[1],10)||3,i=parseInt(t[2],10)||0,n=parseInt(t[3],10)||3,r=t[4]||"controlled",c=parseInt(t[5],10)||0,d=t.slice(6).join(" ")||"",l=Pe(o,i,n,r,c);if(!l){u("Pool must be at least 1 die.","error");return}const y=`[${l.outcome}] ${o}+${i} vs DV${n} (${r}) → ${l.dice.join(" ")} (S:${l.successes} SB:${l.storyBeats})${l.critical?" | 💥 CRIT":""}${d?" — "+d:""}`;J(y,a,"all",{rollData:{outcome:l.outcome,outcomeClass:l.outcomeClass,resultText:l.resultText,dice:l.dice,successes:l.successes,storyBeats:l.storyBeats,reRolls:l.reRolls,reRolledDice:l.reRolledDice,tens:l.tens,critical:l.critical}}),B(()=>import("./bestiary.CPB8-5uX.js").then(T=>T.a).then(T=>{T.logExternalAction?.(a,y,"roll")}),__vite__mapDeps([0,1,2,3,4,5,6,7,8,9,10,11,12,13,14])).catch(()=>{});break}default:u("Unknown command. Try /help","error")}}async function Ve(){const e=Ne();if(!e||typeof e!="string"||e.trim()===""){console.warn("[VTT] No valid room code, cannot push characters.");return}let t=localStorage.getItem("fates-edge-api-key");if(!t){const r=prompt("Enter the server API key (or leave blank if not required):","your-secret-key-here");if(r!==null&&(t=r.trim(),t&&localStorage.setItem("fates-edge-api-key",t)),!t){console.warn("[VTT] No API key – character sync disabled.");return}}const s=O().characters||[];if(s.length===0){console.log("[VTT] No characters to push.");return}const a=ft(),o={};if(s.forEach(r=>{if(r.name){const c=r.attributes||{Body:2,Wits:2,Spirit:2,Presence:2},d={attributes:{Body:c.Body??2,Wits:c.Wits??2,Spirit:c.Spirit??2,Presence:c.Presence??2},harm:r.harm||0,fatigue:r.fatigue||0,obligation:r.obligation||0,boons:r.boons||0,leash:r.leash||0,corruption:r.corruption||0,skills:r.skills||{},avatar:r.avatar||null,playerName:a,patron:r.patron||null};o[r.name]=d}}),Object.keys(o).length===0){console.log("[VTT] No valid character data to push.");return}let i=js();i&&typeof i=="string"&&(i=i.split("?")[0].replace(/\/+$/,""),i===""&&(i=null));let n;i?n=`${i}/rooms/${e}/characters/update`:n=`${window.location.origin||""}/api/rooms/${e}/characters/update`,console.log("[VTT] Pushing characters to endpoint:",n);try{const r=await fetch(n,{method:"POST",headers:{"Content-Type":"application/json","x-api-key":t},body:JSON.stringify({updates:o})});if(r.ok)console.log(`✅ Pushed ${Object.keys(o).length} characters to room ${e}.`),de||(u(`📤 Characters synced to server for room ${e}.`,"success"),de=!0);else{const c=await r.text();console.warn(`❌ Failed to push characters: ${r.status} ${c}`),de||u(`❌ Failed to sync characters (${r.status}). Check API key.`,"error")}}catch(r){console.warn("❌ Error pushing characters:",r),de||u("❌ Error syncing characters. Check connection.","error")}}var _e=null,kn=1500;function xn(){!D()||x||(_e&&clearTimeout(_e),_e=setTimeout(()=>{_e=null,Ve().catch(()=>{})},kn))}Ls(()=>xn());function Ae(e){if(!Array.isArray(e)||e.length===0){m.updateCharacters([]);return}const t=e.map(a=>Es(a));m.updateCharacters(t),ut();const s=m.getSelectedCharacter();s&&(t.some(a=>a.name===s.name)||m.selectCharacter(null)),Oe(),console.log(`[VTT] Received ${t.length} characters from server.`)}function ms(){const e=f("#vtt-combat-status");if(!e)return;if(!nt){e.style.display="none",e.innerHTML="";return}const t=nt,s=t.activeName?`${$(t.activeName)}'s turn`:"awaiting turn order",a=t.timerMax>0?` · ⏱️ ${$(t.timerName||"Timer")} ${t.timerSegments}/${t.timerMax}`:"";e.style.display="inline-flex",e.innerHTML=`⚔️ Round ${t.round} — ${s}${a}`}function ps(){const e=f("#vtt-scene-status");if(!e)return;if(!rt){e.style.display="none",e.innerHTML="";return}const t=rt,s=[t.actTitle,t.sceneTitle].filter(Boolean).map($),a=s.length?s.join(" — "):$(t.adventureTitle||"Adventure in progress");e.style.display="inline-flex",e.innerHTML=`🎭 ${a}`}function Cn(){if(!D()||x)return;vs();try{Ce({type:"state-updated",state:O()})}catch{}const e=F();m.updateCharacters(e),m.updateTimers(O().timers||[]);const t=p=>{if(!x&&(p&&p.characters&&Array.isArray(p.characters)&&Ae(p.characters),p&&p.deckRemaining!==void 0&&(q.remaining=p.deckRemaining,ie()),p&&p.region)){U=p.region;const b=f("#vtt-region-display");b&&(b.textContent=U)}};R("room-state",t),L.set("room-state",t);const s=p=>{if(x)return;let b=null;p&&p.characters&&Array.isArray(p.characters)?b=p.characters:p&&p.state&&p.state.characters&&Array.isArray(p.state.characters)&&(b=p.state.characters),b&&Ae(b),u("📋 Sync complete.","info")};R("sync-state",s),L.set("sync-state",s);const a=p=>{x||(p&&p.characters&&Array.isArray(p.characters)?Ae(p.characters):p&&p.state&&p.state.characters&&Array.isArray(p.state.characters)&&Ae(p.state.characters),p&&p.timers&&m.updateTimers(p.timers))};R("state-updated",a),L.set("state-updated",a);const o=p=>{if(x)return;const b=p.message||p;m.addChatMessage({...b,local:!1,sent:!0}),b.sender!=="GM"&&b.sender!=="System"&&Mt()};R("chat-message",o),L.set("chat-message",o);const i=p=>{x||u(`🎲 ${p.sender||"Player"} rolled ${p.outcome}`,"info")};R("roll-result",i),L.set("roll-result",i);const n=p=>{if(x)return;q={cards:p.cards||[],history:q.history||[],offset:Date.now(),remaining:p.remaining||0};const b=p.cards||[],S=p.synthesis||"",N=p.region||U,E=b.map(W=>W.is_joker?"🃏 Joker":`${W.rank_name||W.rank} of ${W.suit_name||W.suit}`).join(", ");J(`🃏 Drew ${b.length} card${b.length>1?"s":""} from ${N}: ${E}

${S}`,"Deck","all"),ie(),u(`🃏 Drew ${b.length} cards from ${N}`,"success")};R("deck-drawn",n),L.set("deck-drawn",n);const r=p=>{x||(q={cards:[],history:[],offset:Date.now(),remaining:p.remaining||0},J("🔀 Deck shuffled.","Deck","all"),ie(),u("🔀 Deck shuffled","success"))};R("deck-shuffled",r),L.set("deck-shuffled",r);const c=p=>{x||(q={cards:p.cards||[],history:q.history||[],offset:Date.now(),remaining:p.remaining||0},J(`👑 Crown Spread: ${p.result?.synthesis||"A powerful reading..."}`,"Deck","all"),ie(),u("👑 Crown Spread delivered","success"))};R("crown-spread",c),L.set("crown-spread",c);const d=p=>{x||console.log("[VTT] Deck history received:",p)};R("deck-history",d),L.set("deck-history",d);const l=p=>{x||u("🗑️ Deck history cleared","info")};R("deck-history-cleared",l),L.set("deck-history-cleared",l);const y=p=>{if(x)return;we=p.modules||[];const b=we.length;if(b===0)u("📦 No modules loaded.","info");else{const S=we.map(N=>N.name||N.id).join(", ");u(`📦 ${b} module${b>1?"s":""} loaded: ${S}`,"info")}};R("module-list",y),L.set("module-list",y);const T=async p=>{if(x)return;const b=p.module||{},S=b.manifest?.name||b.id||"Unknown",N=b.files&&b.files["adventure.json"];if(!N){u(`📦 Module pushed: ${S} (no adventure.json to auto-install)`,"info");return}try{const E=JSON.parse(N);(await B(()=>import("./adventure-manager.BYGz956n.js"),__vite__mapDeps([15,2,3,1,4,6,5,7,8,9,10,11,12,13,14,0]))).installAdventureContent(E,{sourceLabel:"📦 Module pushed"})}catch(E){console.warn("[VTT] Failed to auto-install pushed module:",E),u(`📦 Module pushed: ${S} (auto-install failed: ${E.message})`,"warning")}};R("module-push",T),L.set("module-push",T);const v=async p=>{if(x)return;const b=p.moduleId||"Unknown";try{const S=(await B(()=>import("./adventure-manager.BYGz956n.js"),__vite__mapDeps([15,2,3,1,4,6,5,7,8,9,10,11,12,13,14,0]))).removeInstalledAdventure(b);u(S?`🧹 Module removed: ${b}`:`🧹 Module cleanup: ${b} (was not installed here)`,"info")}catch(S){console.warn("[VTT] Failed to clean up module:",S),u(`🧹 Module cleanup: ${b}`,"info")}};R("module-cleanup",v),L.set("module-cleanup",v);const A=p=>{if(!x&&p.region){U=p.region;const b=f("#vtt-region-display");b&&(b.textContent=U),u(`📍 Region updated to: ${U}`,"info")}};R("region-updated",A),L.set("region-updated",A);const w=p=>{x||(nt=p&&p.combat||null,ms())};R("combat-status-update",w),L.set("combat-status-update",w);const C=p=>{x||(rt=p&&p.scene||null,ps())};R("scene-status-update",C),L.set("scene-status-update",C);const g=p=>{if(x)return;const{clientId:b,character:S,characters:N}=p;if(!b)return;const E=(Array.isArray(N)?N:S?[S]:[]).filter(Boolean).slice(0,6),W=(m.state.presence||[]).map(ce=>ce.id===b?{...ce,selectedCharacter:E[0]||"",selectedCharacters:E}:ce);if(m.updatePresence(W),b===se()){const ce=m.state.characters||[],ys=E.map($s=>ce.find(ws=>ws.name===$s)?.id).filter(Boolean);m.setSelectedCharacterIds(ys)}};R("character-select",g),L.set("character-select",g);const h=p=>{if(!x&&p.clients){te.clear(),p.clients.forEach(E=>te.set(E.id,E));const b=p.clients.find(E=>E.role==="gm");b?(_.currentGmId=b.id,_.currentGmName=b.name):(_.currentGmId=null,_.currentGmName=null);const S=se();if(S&&te.has(S)){const E=te.get(S);_.myRole!==E.role&&(_.myRole=E.role,document.dispatchEvent(new CustomEvent("gmRoleUpdate",{detail:{role:E.role}})))}const N=p.clients.map(E=>({id:E.id,name:E.name||"Player",role:E.role||"player",online:!0,selectedCharacter:E.selectedCharacter||"",avatar:E.avatar||null}));m.updatePresence(N),ue(),Te()}};R("presence",h),L.set("presence",h);const I=p=>{if(x)return;const{requesterId:b,requesterName:S,currentGmId:N,currentGmName:E}=p,W=se();_.myRole==="gm"&&W===N&&(_.requests.find(ce=>ce.requesterId===b)||_.requests.push({requesterId:b,requesterName:S}),ue(),u(`👑 ${S} requests to become GM.`,"info"),Mt())};R("gm_vote_request",I),L.set("gm_vote_request",I);const M=p=>{if(x)return;const{role:b}=p;_.myRole=b,document.dispatchEvent(new CustomEvent("gmRoleUpdate",{detail:{role:b}}));const S=se();S&&te.has(S)&&(te.get(S).role=b),b==="gm"&&(_.currentGmId=S,_.currentGmName="You"),ue(),u(`Your role is now: ${b.toUpperCase()}`,"success")};R("gm_role_update",M),L.set("gm_role_update",M);const k=p=>{if(x)return;const{targetId:b,role:S,persist:N}=p,E=se();if(b&&te.has(b)&&(te.get(b).role=S),b===E){_.myRole=S,document.dispatchEvent(new CustomEvent("gmRoleUpdate",{detail:{role:S}}));const W={"co-gm":"Co-GM",player:"Player",spectator:"Spectator"}[S]||S;u(`Your role is now: ${W}${S==="co-gm"?N?" (saved)":" (this session only)":""}`,"success")}ue(),Te()};R("role_update",k),L.set("role_update",k);const z=p=>{x||u(p.message,"info")};R("server_announcement",z),L.set("server_announcement",z);const P=()=>{if(x)return;const p=O();try{Ce({type:"state-updated",state:p})}catch{}const b=F();m.updateCharacters(b),m.updateTimers(p.timers||[]),m.setConnectionStatus("connected"),u("Reconnected to server!","success"),de=!1,Ve(),os();const S=m.getSelectedCharacter();S&&Se(S.name)};R("connected",P),L.set("connected",P);const H=()=>{x||(m.setConnectionStatus("local"),u("Disconnected from server. Messages will be local.","warning"),de=!1)};R("disconnected",H),L.set("disconnected",H);const bt=p=>{p.success&&!de&&setTimeout(()=>Ve(),500)};R("handshake_ack",bt),L.set("handshake_ack",bt),console.log("[VTT Connected] WebSocket sync enabled with full character support")}function vs(){for(const[e,t]of L)try{Is(e,t)}catch(s){console.debug("[VTT Connected] Error removing listener:",s)}L.clear()}function ue(){const e=f("#gm-display");e&&(e.textContent=_.currentGmName||"None");const t=f("#gm-role-badge");t&&(t.textContent=_.myRole==="gm"?"You are GM":"Player");const s=f("#gm-actions");s&&(_.myRole==="gm"?s.innerHTML='<button class="btn btn-sm btn-danger" id="vtt-gm-resign">Resign GM</button>':s.innerHTML='<button class="btn btn-sm btn-gold" id="vtt-gm-request">Request GM</button>');const a=f("#gm-requests"),o=f("#gm-requests-list");_.myRole==="gm"&&_.requests.length>0?(a.style.display="block",o.innerHTML=_.requests.map(i=>`
            <div class="vtt-gm-request-row">
                <span>${$(i.requesterName)}</span>
                <div class="vtt-btn-row">
                    <button class="btn btn-sm btn-green gm-approve" data-target="${i.requesterId}">Approve</button>
                    <button class="btn btn-sm btn-danger gm-reject" data-target="${i.requesterId}">Reject</button>
                </div>
            </div>
        `).join("")):(a.style.display="none",o.innerHTML="")}async function Tn(){try{const e=_s(),{initMediaModule:t}=await B(async()=>{const{initMediaModule:s}=await import("./main.hiOZSyFC.js").then(a=>a.b);return{initMediaModule:s}},__vite__mapDeps([7,1,2,3,4,8,6,5,9]));t(e)}catch{}if(!x){if(ee){Ee(),ee=!1;const e=f("#vtt-voice-toggle");e&&(e.textContent="🎤 Voice Off",e.className="btn btn-sm");const t=f("#vtt-mute-toggle");t&&t.remove(),m.updateVoiceClients([]),u("Voice chat disabled.","info")}else if(await it()){ee=!0;const e=f("#vtt-voice-toggle");e&&(e.textContent="🎤 Voice On",e.className="btn btn-sm btn-primary");const t=f(".flex-between .flex:last-child");if(t&&!f("#vtt-mute-toggle")){const s=document.createElement("button");s.id="vtt-mute-toggle",s.className="btn btn-sm btn-green",s.textContent="🎙️ Live",s.addEventListener("click",fs),t.appendChild(s)}u("Voice chat enabled!","success")}}}function fs(){const e=lt(),t=f("#vtt-mute-toggle");t&&(e?(t.textContent="🔇 Muted",t.className="btn btn-sm btn-danger"):(t.textContent="🎙️ Live",t.className="btn btn-sm btn-green"))}function Sn(e){if(!ee){u("Enable voice first.","error");return}const t=qe(e);if(!t){u("Client not found.","error");return}if(t.connectionState==="connected"){u("Already connected to "+t.name,"info");return}Ot(e),u(`Calling ${t.name}...`,"info")}function Pt(){const e=f("#chatInput"),t=f("#chatRecipient");if(!e||!t)return;const s=e.value.trim();if(s){if(s.startsWith("/")){wn(s),e.value="";return}J(s,gt(),t.value),e.value="",e.focus()}}function Mn(){if(x)return;fe.forEach(({event:n,handler:r})=>{Z.removeEventListener(n,r)}),fe=[],ge.forEach(({event:n,handler:r})=>{document.removeEventListener(n,r)}),ge=[],fe=[{event:"click",handler:n=>{const r=n.target.closest("button, .btn, [id]");if(r)switch(r.id){case"chat-send-btn":n.preventDefault(),Pt();break;case"vtt-clear-chat":ot?.(),m.clearChat(),u("Chat cleared.","success");break;case"vtt-refresh-btn":{const c=F();m.updateCharacters(c),m.updateTimers(O().timers||[]),Oe(),u("VTT refreshed.","info");break}case"vtt-roll-post-btn":Vt(!0);break;case"vtt-roll-only-btn":Vt(!1);break;case"vtt-add-timer":B(()=>import("./state.42sFgcOQ.js").then(c=>c.A).then(c=>{const d=c.getState(),l=prompt("Timer name:","Scene Timer");if(l){const y=parseInt(prompt("Segments:","6")||"6"),T={id:"timer-"+Date.now(),name:l,segments:y,current:0};c.addTimer(T),m.updateTimers(d.timers||[]),u(`Timer "${l}" created.`,"success")}}),__vite__mapDeps([3,1,2])).catch(()=>u("Timer feature not available","error"));break;case"vtt-scene-end":{const c=O();(c.characters||[]).forEach(l=>{l.boons>2&&(l.boons=2)});const d=F();m.updateCharacters(d),tt();try{Ce({type:"state-updated",state:c})}catch{}u("Scene ended, boons trimmed.","info");break}case"vtt-voice-toggle":Tn();break;case"vtt-mute-toggle":fs();break;case"vtt-deck-draw-1":Ie(1);break;case"vtt-deck-draw-2":Ie(2);break;case"vtt-deck-draw-3":Ie(3);break;case"vtt-deck-crown":ls();break;case"vtt-deck-shuffle":cs();break;case"vtt-deck-history":ds();break;case"vtt-modules-list":us();break;case"vtt-gm-request":if(!D()){u("Not connected to server.","error");return}yt({type:"request_gm"}),u("Request sent to GM.","info");break;case"vtt-gm-resign":u("To step down, approve a pending request or promote another player.","info")}}},{event:"click",handler:n=>{const r=n.target.closest(".gm-approve"),c=n.target.closest(".gm-reject");if(!r&&!c)return;n.preventDefault();const d=(r||c).dataset.target;d&&(r?(yt({type:"approve_gm",targetId:d}),_.requests=_.requests.filter(l=>l.requesterId!==d),ue(),u(`Approved ${d} as GM.`,"success")):c&&(_.requests=_.requests.filter(l=>l.requesterId!==d),ue(),u(`Rejected request from ${d}.`,"info")))}},{event:"keydown",handler:n=>{n.key==="Enter"&&n.target.id==="chatInput"&&(n.preventDefault(),Pt())}},{event:"change",handler:n=>{n.target.id==="vtt-auto-scroll"&&(me.chatAutoScroll=n.target.checked)}}],fe.forEach(({event:n,handler:r})=>{Z.addEventListener(n,r)});const o=n=>{n.detail?.clientId&&Sn(n.detail.clientId)};document.addEventListener("voice-call-request",o),ge.push({event:"voice-call-request",handler:o});const i=n=>{const{characterName:r,followerName:c,message:d}=n.detail;!d||!c||J(d,`${c} (${r})`,"all")};document.addEventListener("follower-chat",i),ge.push({event:"follower-chat",handler:i})}function gs(e){if(x&&(x=!1),Z=e,Be(e),!e)return;He=J;const t=D(),s=t?Ne():null,a=t?se():null,o=typeof De=="function"?De():"websocket",i=je(),n=ct(),r=q.remaining||0,c=n.map(l=>{const y=qe(l),T=y?.speaking?"var(--gold)":"var(--bg3)",v=y?.name||"Player";return`<span class="voice-client-badge" style="display:inline-flex;align-items:center;gap:0.4rem;padding:0.2rem 0.8rem;border-radius:20px;background:var(--bg4);font-size:0.85rem;border:1px solid var(--border);">
            <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${T};transition:background 0.3s;"></span>
            ${$(v)}
        </span>`}).join("");e.innerHTML=`
    <div class="vtt-live-table">

        <!-- Header -->
        <div class="vtt-header">
        <h1 class="page-title">
            💬 VTT – Live Table
            <span class="mode-indicator vtt-stat-pill ${t?"connected":"disconnected"}">
            ${t?"🌐 Connected":"📡 Local"}
            </span>
            <span class="vtt-stat-pill mode-label">${o}</span>
            <button class="btn btn-sm btn-ghost" onclick="window.location.hash='whiteboard'" title="Open Whiteboard">✏️ Whiteboard</button>
        </h1>
        <p class="page-sub">Chat, party status, quick die roller, deck, and scene timers all in one view.</p>
        </div>

        <!-- Table Status -->
        <div class="panel vtt-card status-panel">
        <div class="vtt-card-header">
            <span class="vtt-card-title">🛰️ Table Status</span>
            <span class="vtt-stat-pill">
            <span class="vtt-dot connection-status" style="background:${t?"var(--vtt-green)":"var(--vtt-red)"};"></span>
            ${t?"🟢 Connected":"🔴 Disconnected"}
            </span>
        </div>
        <div class="vtt-stat-row">
            ${s?`<span class="vtt-stat-pill">🔑 Room <strong>${s}</strong></span>`:""}
            ${a?`<span class="vtt-stat-pill">👤 <strong>${$(ft())}</strong></span>`:""}
            <span class="vtt-stat-pill">📍 ${U}</span>
            <span class="vtt-stat-pill">🃏 <strong id="vtt-deck-count-header">${r}</strong> cards</span>
            <span class="vtt-stat-pill" id="vtt-combat-status" style="display:none;background:var(--bg4);border:1px solid var(--red);"></span>
            <span class="vtt-stat-pill" id="vtt-scene-status" style="display:none;background:var(--bg4);border:1px solid var(--gold);"></span>
        </div>
        <div class="vtt-divider"></div>
        <!-- Voice controls -->
        <div class="vtt-stat-row" style="justify-content:space-between;">
            <div class="vtt-btn-row" style="align-items:center;">
            <button class="btn btn-sm ${ee?"btn-primary":""}" id="vtt-voice-toggle">${ee?"🎤 Voice On":"🎤 Voice Off"}</button>
            ${ee?`<button class="btn btn-sm ${i?.muted?"btn-danger":"btn-green"}" id="vtt-mute-toggle">${i?.muted?"🔇 Muted":"🎙️ Live"}</button>`:""}
            <span class="vtt-stat-pill" id="voice-clients-count">${n.length} voice users</span>
            </div>
        </div>
        <div style="margin-top:0.5rem;display:flex;align-items:center;gap:0.5rem;">
            <span style="font-size:0.9rem;color:var(--vtt-text3);">🎤</span>
            <div style="flex:1;height:6px;background:var(--vtt-surface2);border-radius:3px;overflow:hidden;">
            <div id="voice-activity-bar" style="width:0%;height:100%;background:var(--vtt-gold);border-radius:3px;transition:width 0.1s;"></div>
            </div>
            <span style="font-size:0.8rem;color:var(--vtt-text3);" id="voice-activity-label">idle</span>
        </div>
        <div id="voice-clients-list" style="display:flex;flex-wrap:wrap;gap:0.5rem;margin-top:0.5rem;">
            ${n.length===0?'<span style="color:var(--vtt-text3);font-size:0.9rem;">No other voice clients.</span>':c}
        </div>
        <div class="vtt-divider"></div>
        <div class="vtt-card-header" style="margin-bottom:0.35rem;">
            <span class="vtt-card-title" style="font-size:1rem;">👥 Party Members</span>
            <span class="vtt-stat-pill" id="vtt-mode-badge">${t?"🌐 Online":"📡 Local"}</span>
        </div>
        <div id="presence-list"></div>
        </div>

        <!-- GM Management -->
        <div class="panel vtt-card gm-panel">
        <div class="vtt-card-header">
            <span class="vtt-card-title">👑 Game Master
            <span id="gm-display" style="font-weight:600;font-size:0.95rem;color:var(--vtt-text2);">${_.currentGmName||"None"}</span>
            <span id="gm-role-badge" class="vtt-stat-pill gm-badge">${_.myRole==="gm"?"You are GM":"Player"}</span>
            </span>
            <span id="gm-actions" class="vtt-btn-row">
            ${_.myRole==="gm"?`
                <button class="btn btn-sm btn-danger" id="vtt-gm-resign">Resign GM</button>
            `:`
                <button class="btn btn-sm btn-gold" id="vtt-gm-request">Request GM</button>
            `}
            </span>
        </div>
        <div id="gm-requests" style="display:none;">
            <div class="vtt-divider"></div>
            <span class="text-muted" style="font-size:0.85rem;">Pending requests:</span>
            <div id="gm-requests-list"></div>
        </div>
        </div>

        <!-- Main Grid -->
        <div class="vtt-section-grid">
        <!-- Chat Column -->
        <div class="chat-box vtt-card" style="display:flex;flex-direction:column;min-height:min(55vh, 500px);">
            <div class="vtt-card-header">
            <span class="vtt-card-title">💬 Chat</span>
            <div class="vtt-btn-row" style="align-items:center;">
                <span class="text-muted" id="message-count">0 messages</span>
                <button class="btn btn-sm btn-ghost" id="vtt-clear-chat" title="Clear chat">🗑️</button>
            </div>
            </div>
            <!-- Viewport-relative sizing — see vtt-local.js for the same change. -->
            <div class="chat-messages" id="chatMessages" style="flex:1;overflow-y:auto;padding:0.5rem;background:var(--vtt-surface2);border-radius:calc(var(--vtt-radius) - 2px);margin-bottom:0.5rem;font-size:1rem;display:flex;flex-direction:column;max-height:min(70vh, 600px);min-height:min(35vh, 300px);"></div>
            <div id="selected-character-display" style="margin-bottom:0.4rem;padding:0.2rem 0.4rem;background:var(--vtt-surface2);border-radius:calc(var(--vtt-radius) - 2px);min-height:2.5rem;"></div>
            <div class="chat-input-row" style="display:flex;gap:0.4rem;">
            <input type="text" id="chatInput" placeholder="Type… (/roll, /timer, /deck, /help)" style="flex:1;font-size:1rem;padding:0.5rem 0.6rem;" />
            <select id="chatRecipient" style="flex:0 0 120px;font-size:1rem;">
                <option value="all">All</option>
            </select>
            <button class="btn btn-gold" id="chat-send-btn">Send</button>
            </div>
            <div class="flex mt-1" style="flex-wrap:wrap;gap:0.9rem;font-size:0.9rem;align-items:center;">
            <label class="inline-check"><input type="checkbox" id="vtt-post-chat" checked /> Post rolls to chat</label>
            <label class="inline-check"><input type="checkbox" id="vtt-auto-scroll" checked /> Auto-scroll</label>
            </div>
            <div class="vtt-hint">Try <code>/roll 3 2 3</code>, <code>/deck 1</code>, <code>/crown</code>, or <code>/help</code> for the full command list.</div>
        </div>

        <!-- Sidebar -->
        <div class="vtt-sidebar">
            <div class="vtt-sidebar-scroll">
            <!-- Party Status -->
            <div class="vtt-panel vtt-card">
                <div class="vtt-card-header">
                <span class="vtt-card-title" style="font-size:1.05rem;">👥 Party</span>
                <button class="btn btn-sm btn-ghost" id="vtt-refresh-btn" title="Refresh">↻</button>
                </div>
                <div id="vttCharGrid" class="vtt-char-grid"></div>
                <!-- NEW: detail panel for selected character -->
                <div id="vtt-char-detail" style="margin-top:0.5rem;"></div>
            </div>

            <!-- Combat Actions -->
            <div class="vtt-panel vtt-card">
                <div class="vtt-card-header">
                <span class="vtt-card-title" style="font-size:1.05rem;">⚔️ Combat Actions</span>
                </div>
                <div id="vtt-combat-actions" style="min-height:2.5rem;"></div>
            </div>

            <!-- Mini Combat Tracker — live initiative order + range-to-you,
                 without requiring the full Encounters tracker modal open.
                 See vtt-local.js for the same feature; reads the same
                 encounters/combat.js in-memory session (SPA-wide singleton). -->
            <div class="vtt-panel vtt-card">
                <div class="vtt-card-header">
                <span class="vtt-card-title" style="font-size:1.05rem;">🗡️ Combat Tracker</span>
                <button class="btn btn-sm btn-ghost" onclick="window.location.hash='encounters'" title="Open full Encounters tracker">↗️</button>
                </div>
                <div id="vtt-mini-tracker-body" style="min-height:2rem;"></div>
            </div>

            <!-- Quick Roller -->
            <div class="vtt-panel vtt-card">
                <div class="vtt-card-header">
                <span class="vtt-card-title" style="font-size:1.05rem;">🎲 Quick Roller</span>
                </div>
                <div class="vtt-dice-row">
                <div class="vtt-field">
                    <label>Attr</label>
                    <input type="number" id="vtt-attr" value="3" min="1" max="8" style="width:100%;" />
                </div>
                <div class="vtt-field">
                    <label>Skill</label>
                    <input type="number" id="vtt-skill" value="2" min="0" max="12" style="width:100%;" />
                </div>
                <div class="vtt-field" style="flex:0 0 80px;">
                    <label>DV</label>
                    <select id="vtt-dv">
                    <option value="2">2</option><option value="3" selected>3</option><option value="4">4</option><option value="5">5+</option>
                    </select>
                </div>
                <div class="vtt-field" style="flex:0 0 90px;">
                    <label>Pos</label>
                    <select id="vtt-pos">
                    <option value="dominant">Dom</option><option value="controlled" selected>Ctrl</option><option value="desperate">Desp</option>
                    </select>
                </div>
                <div class="vtt-field" style="flex:0 0 70px;">
                    <label>Boons</label>
                    <input type="number" id="vtt-boons" value="0" min="0" max="5" />
                </div>
                </div>
                <div class="vtt-dice-row" style="margin-top:0.4rem;">
                <div class="vtt-field" style="flex:1 1 140px;">
                    <label>Weapon</label>
                    <select id="vtt-attack-type" title="Weapon weight class — drives the range bonus below (Player's Guide §3.12.1-3.12.3).">
                    <option value="">— N/A —</option>
                    <option value="light">🗡️ Light</option>
                    <option value="medium">⚔️ Medium</option>
                    <option value="heavy">🔨 Heavy</option>
                    <option value="ranged">🏹 Ranged</option>
                    </select>
                </div>
                <div class="vtt-field" style="flex:1 1 160px;">
                    <label>Range (GM-set)</label>
                    <select id="vtt-range" title="The narrative range the GM told you before rolling.">
                    ${Bt.map(l=>`<option value="${l.key}">${l.label}</option>`).join("")}
                    </select>
                </div>
                </div>
                <div id="vtt-common-rolls" style="margin-top:0.5rem;min-height:2.5rem;"></div>
                <div class="vtt-btn-row" style="margin-top:0.5rem;">
                <button class="btn btn-gold btn-sm" id="vtt-roll-post-btn">Roll &amp; Post</button>
                <button class="btn btn-sm" id="vtt-roll-only-btn">Roll Only</button>
                </div>
                <div id="vtt-roll-output" class="mt-1" style="min-height:3rem;padding:0.2rem 0;"></div>
            </div>

            <!-- Deck Panel -->
            <div class="vtt-panel vtt-card">
                <div class="vtt-card-header">
                <span class="vtt-card-title" style="font-size:1.05rem;">🃏 Deck</span>
                <span class="vtt-stat-pill">📍 <strong id="vtt-region-display">${U}</strong></span>
                </div>
                <div class="vtt-btn-row">
                <button class="btn btn-sm btn-gold" id="vtt-deck-draw-1">Draw 1</button>
                <button class="btn btn-sm btn-gold" id="vtt-deck-draw-2">Draw 2</button>
                <button class="btn btn-sm btn-gold" id="vtt-deck-draw-3">Draw 3</button>
                <button class="btn btn-sm btn-primary" id="vtt-deck-crown">👑 Crown</button>
                <button class="btn btn-sm" id="vtt-deck-shuffle">🔀</button>
                <button class="btn btn-sm btn-ghost" id="vtt-deck-history">📜</button>
                <button class="btn btn-sm btn-ghost" id="vtt-modules-list">📦</button>
                </div>
                <div class="vtt-hint">Cards remaining: <strong id="vtt-deck-count">${r}</strong></div>
            </div>

            <!-- Timers -->
            <div class="vtt-panel vtt-card">
                <div class="vtt-card-header">
                <span class="vtt-card-title" style="font-size:1.05rem;">⏱️ Scene Timers</span>
                </div>
                <div id="vttTimerList"></div>
                <div class="vtt-btn-row" style="margin-top:0.5rem;">
                <button class="btn btn-sm" id="vtt-add-timer">+ Add Timer</button>
                <button class="btn btn-sm" id="vtt-scene-end">🌅 Scene End</button>
                </div>
            </div>
            </div>
        </div>
        </div>
    </div>
    `,Kt(),ut(),Jt(),pt(),Yt(),Te(),Qt(),Zt(),Oe(),ms(),ps(),Ht();const d=F();m.updateCharacters(d),m.updateTimers(O().timers||[]),m.setConnectionStatus(t?"connected":"local"),he&&he(),he=dt(l=>{m.updateVoiceClients(l)}),ye&&ye(),ye=m.subscribe("selectedCharacterId",l=>{if(!l)return;const y=m.getSelectedCharacter();y&&y.name&&Se(y.name)}),$e&&$e(),$e=m.subscribe("presence",()=>{x||Te()}),Cn(),Mn(),ue(),D()&&os(),ae&&clearInterval(ae),ae=setInterval(()=>{if(x||!Z){clearInterval(ae),ae=null;return}const l=F();m.updateCharacters(l),m.updateTimers(O().timers||[]),Ht()},me.presenceUpdateInterval),oe&&clearInterval(oe),oe=setInterval(()=>{if(x){clearInterval(oe),oe=null;return}const l=f("#vtt-deck-count");l&&(l.textContent=String(q.remaining||0));const y=f("#vtt-deck-count-header");y&&(y.textContent=String(q.remaining||0))},5e3),window.__vttConnected={sendCharacterSelection:Se},console.log("[VTT Connected] Rendered with reactive store + full character sync + selection broadcast")}function bs(){x=!0,ae&&(clearInterval(ae),ae=null),oe&&(clearInterval(oe),oe=null),ye&&(ye(),ye=null),$e&&($e(),$e=null),Z&&(fe.forEach(({event:e,handler:t})=>{Z.removeEventListener(e,t)}),fe=[],Z.innerHTML="",Be(null),Z=null),ge.forEach(({event:e,handler:t})=>{document.removeEventListener(e,t)}),ge=[],vs(),he&&(he(),he=null),ee&&(Ee(),ee=!1),He=null,window.sendToVTT===is&&delete window.sendToVTT,window.__vttSendMessage&&delete window.__vttSendMessage,window.__vttConnected=null,console.log("[VTT Connected] Destroyed")}var En={render:gs,destroy:bs,sendMessage:J,getContainer:()=>Z,deckDraw:Ie,crownSpread:ls,deckShuffle:cs,deckHistory:ds,clearDeckHistory:bn,moduleList:us,modulePush:yn,moduleCleanup:$n,getDefaultRegion:()=>U,setDefaultRegion:e=>{U=e;const t=f("#vtt-region-display");t&&(t.textContent=e)},pushCharactersToServer:Ve,sendCharacterSelection:Se,initVoice:it,toggleMute:lt,getVoiceStatus:je,cleanupVoice:Ee,getActiveVoiceClients:ct,getVoiceClient:qe,initiateVoiceCall:Ot,onVoiceClientsChanged:dt},K=null,Me=null,le=null;function Ln(e){return e==="local"?on:vn}function hs(e){if(e&&typeof e.destroy=="function")try{e.destroy()}catch(t){console.warn("[VTT] Error destroying module:",t)}}function Nt(e){const t=D()?"connected":"local",s=Ln(t);if(K&&K!==s&&(hs(K),K=null),K===s){Me=e,s.render(e);return}K=s,Me=e,s.render(e),typeof s.sendMessage=="function"&&(window.sendToVTT=(a,o="System",i={})=>{const{isHTML:n=!1,recipient:r="all",metadata:c={}}=i;return n&&o!=="System"&&o!=="GM"?(console.warn("[VTT] HTML messages only allowed for System or GM senders."),!1):(s.sendMessage(a,o,r,c),!0)},console.log("[VTT] Global sendToVTT exposed")),console.log(`[VTT] Switched to ${t} mode`)}function _n(e){le||(le=t=>{Me&&Nt(Me)},wt("connected",le),wt("disconnected",le)),Nt(e)}function An(e,t,s="all",a={}){return K&&typeof K.sendMessage=="function"?K.sendMessage(e,t,s,a):(console.warn("[VTT] No active module to send message"),!1)}function Rn(){return D()}function In(){le&&($t("connected",le),$t("disconnected",le),le=null),hs(K),K=null,Me=null,window.sendToVTT&&delete window.sendToVTT,console.log("[VTT] Destroyed")}var Gn={render:_n,sendMessage:An,isWSConnected:Rn,destroy:In};export{En as a,Gn as default,In as destroy,J as i,Rn as isWSConnected,gs as n,Se as r,_n as render,An as sendMessage,bs as t};
