import{t as de}from"./rolldown-runtime.BQ-_32WO.js";import{i as n}from"./utils.lBShoim5.js";import{D as Q,b as j}from"./state.42sFgcOQ.js";import{n as u}from"./Toast.DDAtBIAw.js";import{n as L}from"./discovery.I-q7Uafb.js";var ce=new Set(["i","a","an","the","to","be","is","of","in","on","for","and","or","my","me","you","your","it","that","this","with","as","at","by","so","am","are","was","were","want","wanna","like","play","playing","character","build","looking","find","need"]),me={druid:["nature","wild","primal","animals","shapeshift","seasons","survival","beast","forest"],ranger:["nature","track","hunt","survival","predator","stealth","ranged"],shaman:["spirit","ancestor","totem","nature","ritual","trance","medicine"],warlock:["pact","demon","eldritch","dark","forbidden","patron","curse","infernal","abyss"],sorcerer:["blood","inheritance","chaos","magic","innate","power"],witch:["curse","hex","cauldron","familiar","ritual","herb","bargain"],rogue:["stealth","deception","thievery","luck","subterfuge","shadow","sneak"],spy:["secret","information","disguise","infiltration","witness"],trickster:["luck","trick","mischief","glamour","deception","jest"],fighter:["combat","weapon","strength","endurance","strike","battle","blade"],barbarian:["rage","fury","primal","strength","reckless","berserk"],paladin:["vow","oath","justice","protection","holy","zeal","crusader"],tank:["protection","defense","ward","guard","endurance","armor","shield"],striker:["damage","combat","strike","aggression","offense","deadly"],support:["heal","buff","aid","protection","comfort","resilience","restore"],healer:["heal","mercy","comfort","restore","cleanse","life"],guardian:["protect","guard","defend","ward","shelter","security"],face:["persuade","charm","social","command","performance","diplomacy","intrigue"],diplomat:["negotiation","treaty","court","speech","persuasion"],performer:["performance","song","dance","entertain","audience","rapture"],mage:["arcane","magic","ritual","spell","knowledge","study"],scholar:["knowledge","lore","research","archive","history","investigation"],artisan:["craft","creation","forge","make","invent","design"],sneaky:["stealth","deception","shadow","subtle","silent","unseen"],night:["moon","shadow","darkness","silence","dream","threshold"],leader:["command","lead","inspire","authority","presence","revolt"],survivor:["endure","persist","adapt","scavenge","survival"],explorer:["travel","road","journey","way","navigation","discovery"]};function pe(t,e,r={}){if(!t||!e||e.length===0)return[];const o=ge(t);if(o.length===0)return[];const l=ue(o),c=l.length>0?l:o;return e.map(p=>{const a=fe(p,c,r);return{patron:p,score:a.score,matchedTags:a.matchedTags}}).filter(p=>p.score>0).sort((p,a)=>a.score-p.score)}function ge(t){return t?t.toLowerCase().replace(/[^a-z0-9\s]/g," ").split(/\s+/).filter(e=>e.length>2&&!ce.has(e)):[]}function ue(t){const e=new Set;for(const r of t)for(const[o,l]of Object.entries(me))if(r===o||r.length>=4&&o.includes(r)||o.length>=4&&r.includes(o))for(const c of l)e.add(c);return Array.from(e)}function fe(t,e,r){let o=0;const l=[],c=[];if(t.tags&&Array.isArray(t.tags)&&c.push({type:"tag",items:t.tags.map(a=>a.toLowerCase())}),r.useDomain!==!1&&t.domain_focus&&Array.isArray(t.domain_focus)&&c.push({type:"domain",items:t.domain_focus.map(a=>a.toLowerCase())}),r.useTitle!==!1){const a=(t.title||t.name||"").toLowerCase().split(/\s+/),m=(t.subtitle||"").toLowerCase().split(/\s+/);c.push({type:"title",items:[...a,...m]})}if(r.useDescription){const a=(t.lore?.description||t.description||"").toLowerCase().split(/\s+/);c.push({type:"description",items:a})}const p=new Set;for(const a of e)for(const m of c)for(const g of m.items){if(!g)continue;const y=`${m.type}:${a}:${g}`;if(p.has(y))continue;let w=0;g===a?w=3:a.length>=4&&g.length>=4&&(g.includes(a)||a.includes(g))&&(w=1.5),w>0&&(o+=w,l.push({source:m.type,term:a,match:g}),p.add(y))}return{score:o,matchedTags:l}}var ze=de({addPatronObligation:()=>N,attachEvents:()=>z,clearPatronObligation:()=>U,default:()=>Pe,destroy:()=>se,getPatronObligation:()=>P,isNinthRevealed:()=>le,loadPatronData:()=>k,onActivate:()=>ie,onDeactivate:()=>oe,refresh:()=>ne,render:()=>re,revealNinth:()=>ae,setPatronObligation:()=>S}),B="./data/patrons/",V="./data/terrestrial/",W="./data/factions/",G="./data/religions/",M=2,J=[{id:"the-traveler",name:"The Traveler",icon:"🚶",domain:"Ways & Journeys",subtitle:"Guide of the Lost",description:"The Traveler is the eternal guide of the road, guardian of those who walk the paths between what is and what might be.",lore:"The Traveler has no fixed form, but appears as a wanderer at every crossroads.",rites:[],source:"default"},{id:"oath-of-flame-light",name:"Oath of Flame & Light",icon:"🔥",domain:"Dawn & Vows",subtitle:"The Unquenchable Fire",description:"The Oath of Flame & Light demands that those who swear within its radiance speak truly and pay the cost of keeping their word.",lore:"Born from the first dawn fire, this patron is invoked by paladins and healers.",rites:[],source:"default"}],Y=[{id:"velvet-court",name:"The Velvet Court",icon:"🎭",type:"Crime Syndicate",tier:"II",description:"A shadowy network of smugglers and information brokers operating in Silkstrand.",location:"Silkstrand",leverage:"Smuggling routes, information, forgery",debtTrigger:"When Obligation fills, they demand a heist or assassination.",quirk:"Every member wears a velvet glove on their left hand.",assetSlots:4,maxAssetTier:"Standard",obligationCapacity:"Spirit+Presence+2",keyNPCs:["Madam Serafine","Old Kes","Sister Agatha"],hooks:["A rival faction is moving into the Dye District"],agendaTimer:{segments:6,current:2},source:"default"},{id:"house-contarini",name:"House Contarini",icon:"🏛️",type:"Noble House",tier:"II",description:"A powerful Vilikari family with deep connections in the Archivolt and trade networks.",location:"Vilikari Marches",leverage:"Legal influence, grain contracts, safe passage",debtTrigger:"When Obligation fills, they demand a political favor or a sealed document.",quirk:"Their seal is a cracked marble column.",assetSlots:4,maxAssetTier:"Standard",obligationCapacity:"Spirit+Presence+1",keyNPCs:["Tema","Factor Voss"],hooks:["A rival house is undercutting their prices"],agendaTimer:{segments:8,current:3},source:"default"}],Z=[{id:"velvet-coin-trust",name:"The Silk Coin",icon:"🪙",tier:"I",description:"A thieves' guild operating in the shadows of Silkstrand.",maxAssets:2,maxAssetTier:"Standard",assets:[],followers:[],obligation:0,capacity:4,source:"default"}],ee=[{id:"everflame",name:"The Everflame",icon:"🔥",description:"The state religion of Ecktoria, born from the imperial forge.",lore:"The Everflame began as a cult of the imperial forge.",doctrines:["The flame witnesses all.","Confession must be public."],practices:["The Candle Test","The Unspoken Ninth Citation"],orders:[{id:"oath_of_flame__light",name:"Oath of Flame & Light",role:"Warriors and crusaders"}],source:"default"}];function s(t){if(t==null)return"";if(typeof t=="string")return t;if(typeof t=="number"||typeof t=="boolean")return String(t);if(Array.isArray(t))return t.map(e=>s(e)).join(", ");if(typeof t=="object"){if(t.name)return s(t.name);if(t.label)return s(t.label);if(t.description)return s(t.description);if(t.lore)return s(t.lore);if(t.effect)return s(t.effect);if(t.text)return s(t.text);if(t.quote)return s(t.quote);try{return JSON.stringify(t)}catch{return"[object]"}}return String(t)}function E(t){return t?t.lore?.description?t.lore.description:typeof t.description=="string"?t.description:t.description?.description?t.description.description:t.description?.lore?t.description.lore:typeof t.lore=="string"?t.lore:s(t.description)||"No description available.":"No description available."}function ve(t){return t?.lore?t.lore:null}function A(t){if(!t)return"";if(t.subtitle&&typeof t.subtitle=="string")return t.subtitle;if(t.domain&&typeof t.domain=="string")return t.domain;if(t.type&&typeof t.type=="string")return t.type;if(t.agenda&&typeof t.agenda=="string")return t.agenda;const e=E(t),r=e.split(".")[0]||e;return r.substring(0,80)+(r.length>80?"...":"")}function x(t){return t?.icon?t.icon:"🌟"}function I(t){return t?.color?t.color:t?.witchcraft?.color?t.witchcraft.color:t?.monastic_tradition?.color?t.monastic_tradition.color:"var(--gold)"}function h(t){if(!t)return t;const e={...t};return!e.name&&e.title&&(e.name=e.title),!e.domain&&e.subtitle&&(e.domain=e.subtitle),e.description&&typeof e.description=="object"&&e.description.description&&(e._rawDescription=e.description,e.description=e.description.description),e.rites&&Array.isArray(e.rites)&&(e.rites=e.rites.map(r=>typeof r=="string"?{name:r,tier:"Basic",xp:4,effect:r}:r)),e}function d(t){return t?n(t).replace(/\n/g,"<br>"):""}function f(t,e){const r=(t.name||t.title||"").toLowerCase(),o=(e.name||e.title||"").toLowerCase();return r.localeCompare(o)}function be(t){return{Cantrip:"var(--text3)",Basic:"#6baa7a",Low:"#6baa7a",Standard:"#d4af37",Advanced:"#c47a7a",Master:"#b84a8a",Epic:"#d94a4a",High:"#8e44ad"}[t]||"var(--text2)"}var $=!1;function _(t){if(!t)return!1;const e=t.id||"",r=(t.name||t.title||"").toLowerCase();return e==="the-ninth"||r==="the ninth"||r==="ninth"}function ye(t){if(!t)return!1;const e=t.toLowerCase().trim();return["ninth","the ninth","forbidden","hidden","secret","unspoken","void","infinite","overflow","knowledge","truth beyond","easter egg","beyond comprehension"].some(r=>e.includes(r))}var D=null,i={cosmicPatrons:[],terrestrialPatrons:[],trusts:[],religions:[],selectedPatron:null,selectedTrust:null,selectedAsset:null,selectedReligion:null,viewMode:"cosmic",isLoading:!1,dataLoaded:!1,usingFallback:!1,obligation:{},expandedRites:new Set,expandedSections:new Set,recommender:{query:"",results:null,active:!1}},X=!1;async function k(t=!1){X||(t=!0),X=!0;const e=j(),r=e.patrons?._schemaVersion===M;if(!t&&e.patrons&&r&&(e.patrons.cosmic?.length||e.patrons.terrestrial?.length)){i.cosmicPatrons=(e.patrons.cosmic||[]).map(h).sort(f),i.terrestrialPatrons=(e.patrons.terrestrial||[]).map(h).sort(f),i.trusts=(e.patrons.trusts||[]).sort(f),i.religions=(e.patrons.religions||[]).sort(f),i.obligation=e.patrons.obligation||{},console.log(`📦 Loaded from state: ${i.cosmicPatrons.length} cosmic, ${i.terrestrialPatrons.length} terrestrial, ${i.religions.length} religions`),i.dataLoaded=!0,i.usingFallback=!1;return}e.patrons&&!r&&console.log(`📦 Cached patron data is schema v${e.patrons._schemaVersion??"unknown"}, current is v${M} — reloading from disk.`),await te(t)}var T=null;async function te(t=!1){if(T)return T;i.isLoading=!0,T=(async()=>{try{const e=await L("cosmic",B,null,t),r=await L("terrestrial",V,W,t),o=await L("religion",G,null,t);let l=[];for(const a of e)try{const m=await fetch(`${B}${a}.json`);if(m.ok){const g=await m.json();g.id||(g.id=a),g.id=g.id.replace(/_/g,"-"),l.push(h(g))}}catch{}l.length===0&&(l=J.map(h),i.usingFallback=!0,u("⚠️ No cosmic patron files found. Using defaults.","warning")),i.cosmicPatrons=l.sort(f);let c=[];for(const a of r)try{let m=await fetch(`${V}${a}.json`);if(m.ok||(m=await fetch(`${W}${a}.json`)),m.ok){const g=await m.json();g.id||(g.id=a),g.id=g.id.replace(/_/g,"-"),c.push(h(g))}}catch{}c.length===0&&(c=Y.map(h),i.usingFallback=!0,u("⚠️ No terrestrial patron files found. Using defaults.","warning")),i.terrestrialPatrons=c.sort(f);let p=[];for(const a of o)try{const m=await fetch(`${G}${a}.json`);if(m.ok){const g=await m.json();g.id||(g.id=a),g.id=g.id.replace(/_/g,"-"),p.push(g)}}catch{}p.length===0&&(p=ee,i.usingFallback=!0,u("⚠️ No religion files found. Using defaults.","warning")),i.religions=p.sort(f),i.trusts.length===0?i.trusts=Z.sort(f):i.trusts.sort(f),i.dataLoaded=!0,b()}catch(e){console.warn("Failed to load remote patrons:",e),O(),u("⚠️ Error loading patrons. Using defaults.","error")}finally{i.isLoading=!1}})();try{await T}finally{T=null}}function O(){i.cosmicPatrons=J.map(h).sort(f),i.terrestrialPatrons=Y.map(h).sort(f),i.trusts=Z.sort(f),i.religions=ee.sort(f),i.dataLoaded=!0,i.usingFallback=!0,console.log(`📦 Using defaults: ${i.cosmicPatrons.length} cosmic, ${i.terrestrialPatrons.length} terrestrial, ${i.religions.length} religions`)}function b(){const t=j();t.patrons||(t.patrons={}),t.patrons.cosmic=i.cosmicPatrons,t.patrons.terrestrial=i.terrestrialPatrons,t.patrons.trusts=i.trusts,t.patrons.religions=i.religions,t.patrons.obligation=i.obligation,t.patrons._schemaVersion=M,Q()}function P(t,e){return i.obligation[t]&&i.obligation[t][e]||0}function S(t,e,r){i.obligation[t]||(i.obligation[t]={}),i.obligation[t][e]=Math.max(0,r),b()}function N(t,e,r=1){S(t,e,P(t,e)+r)}function U(t,e,r=1){S(t,e,P(t,e)-r)}function re(t){D=t,k();const e=i.usingFallback;D.innerHTML=`
        <div class="patrons-modern-layout">
            <header class="patrons-header" style="margin-bottom:0.5rem;">
                <h1 class="patrons-title">👁️ Patrons & Resources</h1>
                <p class="patrons-subtitle">Cosmic patrons, terrestrial powers, religions, and the assets they grant.</p>
                ${i.dataLoaded?`<p class="text-muted" style="font-size:0.85rem;">📚 ${i.cosmicPatrons.length} cosmic, ${i.terrestrialPatrons.length} terrestrial, ${i.religions.length} religions</p>`:'<p class="text-muted" style="font-size:0.85rem;">⏳ Loading data...</p>'}
                ${e?'<div style="color:var(--warn);font-size:0.85rem;margin-top:0.3rem;">⚠️ Using fallback defaults for some data.</div>':""}
            </header>
 
            <div class="patrons-tabs" style="display:flex;gap:0.3rem;margin-bottom:0.5rem;flex-wrap:wrap;">
                <button class="patrons-tab active" data-view="cosmic">🌟 Cosmic</button>
                <button class="patrons-tab" data-view="terrestrial">🏛️ Terrestrial</button>
                <button class="patrons-tab" data-view="trusts">🤝 Trusts</button>
                <button class="patrons-tab" data-view="religions">⛪ Religions</button>
            </div>
 
            <div id="patrons-view-container" class="patrons-view-container">
                ${F("cosmic")}
            </div>
 
            <div id="patron-modal" class="patron-modal" style="display:none;"></div>
            <div id="asset-modal" class="patron-modal" style="display:none;"></div>
        </div>
    `,z()}function F(t){if(i.viewMode=t,!i.dataLoaded)return'<div class="patrons-empty"><div style="font-size:3rem;">⏳</div><div>Loading...</div></div>';switch(t){case"cosmic":return K();case"terrestrial":return he();case"trusts":return $e();case"religions":return we();default:return K()}}function K(){if(i.cosmicPatrons.length===0)return`
            <div class="patrons-empty">
                <div style="font-size:3rem;">🌟</div>
                <div>No cosmic patrons loaded.</div>
                <button class="btn btn-primary" onclick="window.loadDefaultPatrons()">📥 Load Defaults</button>
            </div>
        `;const t=i.obligation["default-character"]||{},e=i.recommender,r=`
        <div class="patron-recommender" style="display:flex;gap:0.3rem;align-items:center;background:var(--bg2);border-radius:var(--radius);padding:0.3rem 0.5rem;border:1px solid var(--border);flex-wrap:wrap;">
            <span style="font-size:0.75rem;color:var(--text3);white-space:nowrap;">🔮 Find your patron:</span>
            <input type="text" id="patron-recommender-input" value="${n(e.query)}"
                placeholder="e.g. 'a nature-loving druid' or 'stealthy rogue who steals secrets'"
                onkeydown="if(event.key==='Enter') window.runPatronRecommender()"
                style="flex:1;min-width:160px;background:var(--bg3);border:1px solid var(--border);border-radius:4px;padding:0.2rem 0.4rem;font-size:0.75rem;" />
            <button class="btn btn-xs btn-primary" onclick="window.runPatronRecommender()">Search</button>
            ${e.active?'<button class="btn btn-xs btn-ghost" onclick="window.clearPatronRecommender()" style="color:var(--text3);">✕ Clear</button>':""}
        </div>
    `;ye(e.query||"")&&!$&&($=!0,setTimeout(()=>{u("🔮 You sense a presence beyond the eighth threshold...","info")},300));let o=[...i.cosmicPatrons];$||(o=o.filter(a=>!_(a)));let l=o,c={},p="";if(e.active&&e.results){const a=e.results.filter(m=>!_(m.patron)||$);a.length===0&&e.results.length>0?(p=`<div style="font-size:0.75rem;color:var(--purple);padding:0.3rem;background:var(--bg3);border-radius:var(--radius);border-left:3px solid var(--purple);">
                🔮 <em>"The Ninth is not found. It finds you."</em> — Try a different search, or seek what is hidden.
                ${$?"":'<br><span style="font-size:0.65rem;color:var(--text3);">(Hint: seek <strong>forbidden knowledge</strong>)</span>'}
            </div>`,l=o):a.length===0?(p=`<div style="font-size:0.75rem;color:var(--text3);padding:0.3rem;">No visible patrons matched "${n(e.query)}" — showing the full list instead.</div>`,l=o):(l=a.map(m=>m.patron),a.forEach(m=>{c[m.patron.id]=m.matchedTags.slice(0,3).map(g=>g.match)}),e.results.some(m=>_(m.patron)&&!$)?p=`<div style="font-size:0.75rem;color:var(--purple);padding:0.2rem 0.3rem;font-style:italic;">
                    🔮 ${a.length} match${a.length===1?"":"es"} for "${n(e.query)}". 
                    <span style="color:var(--text3);">Something stirs beyond the eighth threshold...</span>
                </div>`:p=`<div style="font-size:0.7rem;color:var(--gold);padding:0.2rem 0.3rem;">
                    🔮 ${a.length} match${a.length===1?"":"es"} for "${n(e.query)}", best first.
                </div>`)}else $&&(p=`<div style="font-size:0.7rem;color:var(--purple);padding:0.2rem 0.3rem;font-style:italic;">
            🌌 <em>The Ninth has revealed itself to you.</em>
        </div>`);return`
        <div style="display:flex;flex-direction:column;gap:0.5rem;">
            ${r}
            ${p}

            <div class="patrons-scroll-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:0.5rem;max-height:220px;overflow-y:auto;padding:0.2rem;border:1px solid var(--border);border-radius:var(--radius);background:var(--bg2);">
                ${l.map(a=>{const m=t[a.id]||0,g=s(a.name||a.title||"Unnamed"),y=A(a),w=x(a),C=I(a),q=c[a.id],R=_(a);return`
                        <div class="patron-tile" onclick="window.viewPatron('${a.id}')" style="background:var(--bg3);border-radius:var(--radius);padding:0.3rem 0.5rem;cursor:pointer;display:flex;flex-direction:column;align-items:center;text-align:center;border-left:3px solid ${C};transition:all 0.2s;${q?"border:1px solid var(--gold);":""}${R?"border:1px solid var(--purple);position:relative;":""}">
                            ${R?'<div style="position:absolute;top:-6px;right:-4px;font-size:0.7rem;color:var(--purple);">🔮</div>':""}
                            <div style="font-size:1.5rem;">${s(w)}</div>
                            <div style="font-size:0.75rem;font-weight:600;color:var(--text);">${n(g)}</div>
                            <div style="font-size:0.6rem;color:var(--text3);">${n(y)}</div>
                            ${q?`<div style="font-size:0.55rem;color:var(--gold);margin-top:0.1rem;">🔮 ${q.map(n).join(", ")}</div>`:""}
                            ${R?'<div style="font-size:0.55rem;color:var(--purple);margin-top:0.05rem;">🌌 Beyond the Eighth</div>':""}
                            <div style="font-size:0.55rem;color:var(--text2);margin-top:0.1rem;">Oblig: ${m}</div>
                        </div>
                    `}).join("")}
            </div>
 
            <div id="cosmic-description-area" style="background:var(--bg2);border-radius:var(--radius);padding:0.8rem;border-left:4px solid var(--gold);min-height:80px;">
                <p style="color:var(--text2);font-style:italic;margin:0;">Select a patron above to see their description and details.</p>
            </div>
 
            <div class="patrons-actions" style="display:flex;gap:0.3rem;flex-wrap:wrap;">
                <button class="btn btn-primary btn-sm" onclick="window.addCosmicPatron()">➕ Add Cosmic</button>
                <button class="btn btn-secondary btn-sm" onclick="window.refreshPatrons()">🔄 Refresh</button>
                <button class="btn btn-secondary btn-sm" onclick="window.loadDefaultPatrons()">📥 Load Defaults</button>
            </div>
        </div>
    `}function he(){return i.terrestrialPatrons.length===0?`
            <div class="patrons-empty">
                <div style="font-size:3rem;">🏛️</div>
                <div>No terrestrial patrons loaded.</div>
                <button class="btn btn-primary" onclick="window.addTerrestrialPatron()">➕ Add Terrestrial</button>
                <button class="btn btn-secondary" onclick="window.loadDefaultPatrons()">📥 Load Defaults</button>
            </div>
        `:`
        <div style="display:flex;flex-direction:column;gap:0.8rem;">
            <div class="patrons-scroll-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:0.5rem;max-height:220px;overflow-y:auto;padding:0.2rem;border:1px solid var(--border);border-radius:var(--radius);background:var(--bg2);">
                ${i.terrestrialPatrons.map(t=>{const e=s(t.name||t.title||"Unnamed"),r=A(t),o=x(t)||"🏛️",l=t.color||"#2980b9";return`
                        <div class="patron-tile" onclick="window.viewTerrestrial('${t.id}')" style="background:var(--bg3);border-radius:var(--radius);padding:0.3rem 0.5rem;cursor:pointer;display:flex;flex-direction:column;align-items:center;text-align:center;border-left:3px solid ${l};transition:all 0.2s;">
                            <div style="font-size:1.5rem;">${s(o)}</div>
                            <div style="font-size:0.75rem;font-weight:600;color:var(--text);">${n(e)}</div>
                            <div style="font-size:0.6rem;color:var(--text3);">${n(r)}</div>
                            <div style="font-size:0.55rem;color:var(--text2);">Tier ${s(t.tier||"I")}</div>
                        </div>
                    `}).join("")}
            </div>
 
            <div id="terrestrial-description-area" style="background:var(--bg2);border-radius:var(--radius);padding:0.8rem;border-left:4px solid var(--blue);min-height:80px;">
                <p style="color:var(--text2);font-style:italic;margin:0;">Select a terrestrial patron to see details.</p>
            </div>
 
            <div class="patrons-actions" style="display:flex;gap:0.3rem;flex-wrap:wrap;">
                <button class="btn btn-primary btn-sm" onclick="window.addTerrestrialPatron()">➕ Add Terrestrial</button>
                <button class="btn btn-secondary btn-sm" onclick="window.refreshPatrons()">🔄 Refresh</button>
            </div>
        </div>
    `}function we(){return i.religions.length===0?`
            <div class="patrons-empty">
                <div style="font-size:3rem;">⛪</div>
                <div>No religions loaded.</div>
                <button class="btn btn-primary" onclick="window.addReligion()">➕ Add Religion</button>
            </div>
        `:`
        <div class="religions-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:0.5rem;">
            ${i.religions.map(t=>{const e=s(t.name||t.title||"Unnamed"),r=t.orders?t.orders.length:0,o=t.icon||"⛪";return`
                    <div class="religion-card" onclick="window.viewReligion('${t.id}')" style="background:var(--bg3);border-radius:var(--radius);padding:0.5rem;cursor:pointer;border-left:3px solid var(--gold);">
                        <div style="font-size:1.5rem;">${s(o)}</div>
                        <div style="font-weight:600;">${n(e)}</div>
                        <div style="font-size:0.7rem;color:var(--text3);">${r} Orders</div>
                    </div>
                `}).join("")}
        </div>
        <div class="patrons-actions" style="margin-top:0.5rem;">
            <button class="btn btn-primary" onclick="window.addReligion()">➕ Add Religion</button>
            <button class="btn btn-secondary" onclick="window.refreshPatrons()">🔄 Refresh</button>
        </div>
    `}function $e(){return i.trusts.length===0?`
            <div class="patrons-empty">
                <div style="font-size:3rem;">🤝</div>
                <div>No trusts created yet.</div>
                <button class="btn btn-primary" onclick="window.addTrust()">➕ Create Trust</button>
            </div>
        `:`
        <div class="trusts-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:0.5rem;">
            ${i.trusts.map(t=>{const e=s(t.name||t.title||"Unnamed"),r=s(t.tier||"I"),o=t.icon||"🤝";return`
                    <div class="trust-card" onclick="window.viewTrust('${t.id}')" style="background:var(--bg3);border-radius:var(--radius);padding:0.5rem;cursor:pointer;border-left:3px solid var(--gold);">
                        <div style="font-size:1.5rem;">${s(o)}</div>
                        <div style="font-weight:600;">${n(e)}</div>
                        <div style="font-size:0.7rem;color:var(--text3);">Tier ${n(r)}</div>
                    </div>
                `}).join("")}
        </div>
        <div class="patrons-actions" style="margin-top:0.5rem;">
            <button class="btn btn-primary" onclick="window.addTrust()">➕ Create Trust</button>
            <button class="btn btn-secondary" onclick="window.refreshPatrons()">🔄 Refresh</button>
        </div>
    `}function H(t){const e=i.cosmicPatrons.find(a=>a.id===t);if(!e){u("Patron not found","error");return}const r=document.getElementById("cosmic-description-area");if(!r)return;const o=E(e),l=s(e.name||e.title||"Unnamed"),c=A(e),p=x(e);I(e),r.innerHTML=`
        <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;">
            <span style="font-size:1.5rem;">${s(p)}</span>
            <span style="font-weight:600;font-size:1.1rem;">${n(l)}</span>
            <span style="color:var(--text3);font-size:0.85rem;">${n(c)}</span>
            <span style="color:var(--text3);font-size:0.75rem;margin-left:auto;">Obligation: ${P("default-character",e.id)}</span>
            <button class="btn btn-xs btn-primary" onclick="window.addPatronObligation('default-character', '${e.id}', 1)">➕</button>
            <button class="btn btn-xs btn-secondary" onclick="window.clearPatronObligation('default-character', '${e.id}', 1)">➖</button>
            <button class="btn btn-xs btn-ghost" onclick="window.openPatronDetailModal('${e.id}')">📖 Full Details</button>
        </div>
        <div style="margin:0.3rem 0 0 0;color:var(--text2);font-size:0.9rem;line-height:1.5;overflow-y:auto;">
            ${d(o)}
        </div>
    `}function xe(t){if(!t)return!1;const e=s(t.effect||t.description||"").length>0,r=t.tier||t.xp||t.action||t.range||t.resist||t.materials||t.cost||t.duration||t.invoke||t.requires||t.push_it||t.timer||t.integrity_timer||t.tags&&t.tags.length>0;return e||r}window.toggleRite=function(t){const e=t.closest(".rite-item");if(!e)return;const r=e.querySelector(".rite-details");if(!r)return;const o=r.style.display!=="none";r.style.display=o?"none":"block";const l=e.querySelector(".rite-expand-icon");l&&(l.textContent=o?"▸":"▾");const c=e.dataset.riteId;c&&(o?i.expandedRites.delete(c):i.expandedRites.add(c))};window.expandAllRites=function(){const t=document.getElementById("patron-modal");t&&t.querySelectorAll(".rite-item.rite-expandable").forEach(e=>{const r=e.querySelector(".rite-details");if(r){r.style.display="block";const o=e.querySelector(".rite-expand-icon");o&&(o.textContent="▾");const l=e.dataset.riteId;l&&i.expandedRites.add(l)}})};window.collapseAllRites=function(){const t=document.getElementById("patron-modal");t&&t.querySelectorAll(".rite-item.rite-expandable").forEach(e=>{const r=e.querySelector(".rite-details");if(r){r.style.display="none";const o=e.querySelector(".rite-expand-icon");o&&(o.textContent="▸");const l=e.dataset.riteId;l&&i.expandedRites.delete(l)}})};window.openPatronDetailModal=function(t){const e=i.cosmicPatrons.find(y=>y.id===t);if(!e){u("Patron not found","error");return}const r=document.getElementById("patron-modal");r.style.display="block";const o=s(e.name||e.title||"Unnamed");A(e),E(e);const l=x(e),c=I(e),p=s(e.domain||e.subtitle||"Unknown Domain"),a=s(e.religion||""),m=P("default-character",e.id);ve(e);const g=ke(e);r.innerHTML=`
        <div class="modal-content patron-detail" style="width: 90%; max-width: 1200px; max-height: 90vh; overflow-y: auto; background:var(--bg1); padding:1.5rem; border-radius:var(--radius);">
            <button class="modal-close" onclick="window.closePatronModal()" style="float:right;background:none;border:none;font-size:1.5rem;cursor:pointer;color:var(--text3);">✕</button>
 
            <!-- Header -->
            <div class="patron-detail-header" style="display:flex;align-items:center;gap:1rem;margin-bottom:1rem;border-bottom:1px solid var(--border);padding-bottom:0.5rem;">
                <div class="patron-detail-icon" style="font-size:3rem;">${n(l)}</div>
                <div style="flex:1;">
                    <h2 style="margin:0;color:${c};">${n(o)}</h2>
                    <div class="patron-detail-domain" style="color:var(--text2);font-size:1.1rem;">${n(p)}</div>
                    <div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-top:0.3rem;">
                        ${a?`<span class="badge badge-religion" style="background:${c};color:var(--bg);padding:0.1rem 0.5rem;border-radius:12px;font-size:0.8rem;">⛪ ${n(a)}</span>`:""}
                        ${e.tags&&e.tags.length>0?e.tags.slice(0,5).map(y=>`<span class="badge" style="background:var(--bg3);color:var(--text3);padding:0.05rem 0.4rem;border-radius:8px;font-size:0.65rem;">${n(y)}</span>`).join(""):""}
                        ${e.source==="default"?'<span class="badge badge-remote" style="background:var(--bg3);color:var(--text3);padding:0.1rem 0.5rem;border-radius:12px;font-size:0.7rem;">📦 Default Data</span>':""}
                    </div>
                    <div style="margin-top:0.5rem;font-size:0.9rem;display:flex;gap:0.5rem;align-items:center;">
                        <span>Obligation: <strong>${m}</strong></span>
                        <button class="btn btn-xs btn-primary" onclick="window.addPatronObligation('default-character', '${e.id}', 1)">➕</button>
                        <button class="btn btn-xs btn-secondary" onclick="window.clearPatronObligation('default-character', '${e.id}', 1)">➖</button>
                    </div>
                </div>
            </div>
 
            <!-- Body -->
            <div class="patron-detail-body" style="display:flex;flex-direction:column;gap:0.8rem;">
                ${g}
            </div>
 
            <!-- Actions -->
            <div class="patron-detail-actions" style="display:flex;gap:0.5rem;margin-top:1rem;border-top:1px solid var(--border);padding-top:0.5rem;">
                <button class="btn btn-sm" onclick="window.editPatron('${e.id}')">✏️ Edit</button>
                <button class="btn btn-sm btn-danger" onclick="window.deletePatron('${e.id}')">🗑️ Delete</button>
                <button class="btn btn-sm btn-secondary" onclick="window.closePatronModal()">Close</button>
            </div>
        </div>
    `,r.onclick=y=>{y.target===r&&window.closePatronModal()}};function ke(t){let e="";if(t.lore){const r=t.lore;e+=`
            <div class="patron-detail-section" style="background:var(--bg2);border-radius:var(--radius);padding:0.8rem;border-left:4px solid var(--gold);">
                <h3 style="margin:0 0 0.3rem 0;color:var(--gold);">📚 Lore</h3>
                ${r.description?`<p style="margin:0.3rem 0;white-space:pre-wrap;">${d(r.description)}</p>`:""}
                ${r.followers?`<p style="margin:0.3rem 0;white-space:pre-wrap;"><strong>Followers:</strong> ${d(r.followers)}</p>`:""}
                ${r.quote?`<blockquote style="margin:0.3rem 0;padding:0.5rem 1rem;background:var(--bg3);border-radius:var(--radius);border-left:4px solid var(--gold);"><em>${d(r.quote)}</em></blockquote>`:""}
                ${r.names_across_regions?`
                    <div style="margin:0.3rem 0;"><strong>Names Across Regions:</strong></div>
                    ${Object.entries(r.names_across_regions).map(([o,l])=>`<div style="font-size:0.85rem;color:var(--text2);padding:0.1rem 0;">• <strong>${n(o)}:</strong> ${d(l)}</div>`).join("")}
                `:""}
                ${r.signs&&r.signs.length>0?`
                    <div style="margin:0.3rem 0;"><strong>Signs:</strong></div>
                    <ul style="margin:0;padding-left:1.2rem;list-style-type:disc;">
                        ${r.signs.map(o=>`<li>${d(o)}</li>`).join("")}
                    </ul>
                `:""}
                ${r.quotes&&r.quotes.length>0?`
                    <div style="margin:0.3rem 0;"><strong>Quotes:</strong></div>
                    ${r.quotes.map(o=>`<blockquote style="margin:0.3rem 0;padding:0.3rem 0.8rem;background:var(--bg3);border-radius:var(--radius);border-left:3px solid var(--gold);font-size:0.85rem;">${d(o)}</blockquote>`).join("")}
                `:""}
            </div>
        `}if(t.domain_focus&&t.domain_focus.length>0&&(e+=`
            <div class="patron-detail-section" style="background:var(--bg2);border-radius:var(--radius);padding:0.8rem;border-left:4px solid var(--gold);">
                <h3 style="margin:0 0 0.3rem 0;color:var(--gold);">🎯 Domain Focus</h3>
                <ul style="margin:0;padding-left:1.2rem;list-style-type:disc;">
                    ${t.domain_focus.map(r=>`<li>${n(s(r))}</li>`).join("")}
                </ul>
            </div>
        `),t.patrons_gift){const r=t.patrons_gift;e+=`
            <div class="patron-detail-section" style="background:var(--bg2);border-radius:var(--radius);padding:0.8rem;border-left:4px solid var(--gold);">
                <h3 style="margin:0 0 0.3rem 0;color:var(--gold);">🎁 Patron's Gift</h3>
                ${r.name?`<p style="margin:0.2rem 0;"><strong>${n(r.name)}</strong></p>`:""}
                ${r.description?`<p style="margin:0.2rem 0;">${d(r.description)}</p>`:""}
                ${r.effect?`<p style="margin:0.2rem 0;"><strong>Effect:</strong> ${d(r.effect)}</p>`:""}
                ${r.cost?`<p style="margin:0.2rem 0;color:var(--text3);">Cost: ${d(r.cost)}</p>`:""}
            </div>
        `}if(t.rites&&t.rites.length>0&&(typeof t.rites[0]=="object"&&t.rites[0].effect!==void 0?e+=`
                <div class="patron-detail-section" style="background:var(--bg2);border-radius:var(--radius);padding:0.8rem;border-left:4px solid var(--gold);">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin:0 0 0.5rem 0;flex-wrap:wrap;gap:0.3rem;">
                        <h3 style="margin:0;color:var(--gold);">🔮 Rites (${t.rites.length})</h3>
                        <div style="display:flex;gap:0.3rem;">
                            <button class="btn btn-xs btn-secondary" onclick="window.expandAllRites()">📖 Expand All</button>
                            <button class="btn btn-xs btn-secondary" onclick="window.collapseAllRites()">📕 Collapse All</button>
                        </div>
                    </div>
                    <div class="rites-list" style="display:flex;flex-direction:column;gap:0.5rem;">
                        ${t.rites.map((r,o)=>{const l=`${t.id}-rite-${o}`,c=i.expandedRites.has(l),p=xe(r),a=s(r.name),m=s(r.tier||""),g=s(r.effect||r.description||""),y=be(m);let w="";return p&&(w=`
                                    <div class="rite-details" style="margin-top:0.4rem;padding:0.5rem 0.8rem;background:var(--bg3);border-radius:var(--radius);${c?"":"display:none;"}">
                                        ${g?`<div class="rite-description" style="margin-bottom:0.4rem;line-height:1.5;">${d(g)}</div>`:""}
                                        ${r.materials?`<div class="rite-meta" style="font-size:0.85rem;color:var(--text2);margin-bottom:0.15rem;"><strong>📦 Materials:</strong> ${d(s(r.materials))}</div>`:""}
                                        ${r.push_it?`<div class="rite-meta" style="font-size:0.85rem;color:var(--text2);margin-bottom:0.15rem;"><strong>⚡ Push It:</strong> ${d(s(r.push_it))}</div>`:""}
                                        <div style="display:flex;flex-wrap:wrap;gap:0.3rem 0.8rem;font-size:0.75rem;color:var(--text3);margin-top:0.15rem;">
                                            ${r.tier?`<span><strong>Tier:</strong> ${n(s(r.tier))}</span>`:""}
                                            ${r.xp?`<span><strong>XP:</strong> ${n(s(r.xp))}</span>`:""}
                                            ${r.action?`<span><strong>Action:</strong> ${n(s(r.action))}</span>`:""}
                                            ${r.range?`<span><strong>Range:</strong> ${n(s(r.range))}</span>`:""}
                                            ${r.resist?`<span><strong>Resist:</strong> ${n(s(r.resist))}</span>`:""}
                                            ${r.invoke?`<span><strong>Invoke:</strong> ${n(s(r.invoke))}</span>`:""}
                                            ${r.requires?`<span><strong>Requires:</strong> ${d(s(r.requires))}</span>`:""}
                                            ${r.cost?`<span><strong>Cost:</strong> ${d(s(r.cost))}</span>`:""}
                                            ${r.timer?`<span><strong>Timer:</strong> ${n(s(r.timer))}</span>`:""}
                                            ${r.integrity_timer?`<span><strong>Integrity Timer:</strong> ${n(s(r.integrity_timer))}</span>`:""}
                                        </div>
                                        ${r.tags&&r.tags.length>0?`
                                            <div class="rite-tags" style="display:flex;gap:0.2rem;flex-wrap:wrap;margin-top:0.2rem;">
                                                ${r.tags.map(C=>`<span class="badge badge-tag" style="background:var(--bg2);padding:0.05rem 0.4rem;border-radius:8px;font-size:0.65rem;color:var(--text3);border:1px solid var(--border);">${n(s(C))}</span>`).join("")}
                                            </div>
                                        `:""}
                                    </div>
                                `),`
                                <div class="rite-item ${p?"rite-expandable":""}" data-rite-id="${n(l)}" style="background:var(--bg3);border-radius:var(--radius);padding:0.4rem 0.8rem;border-left:3px solid ${y};">
                                    <div class="rite-header" ${p?'onclick="window.toggleRite(this)"':""} style="display:flex;justify-content:space-between;align-items:center;cursor:${p?"pointer":"default"};">
                                        <span class="rite-name" style="font-weight:600;">${n(a)}</span>
                                        <span style="display:flex;align-items:center;gap:0.5rem;">
                                            ${m?`<span class="rite-tier" style="font-size:0.75rem;color:${y};font-weight:600;">${n(m)}</span>`:""}
                                            ${r.xp?`<span style="font-size:0.7rem;color:var(--text3);">${n(s(r.xp))} XP</span>`:""}
                                            ${p?`<span class="rite-expand-icon" style="font-size:0.8rem;color:var(--text3);">${c?"▾":"▸"}</span>`:""}
                                        </span>
                                    </div>
                                    ${w}
                                </div>
                            `}).join("")}
                    </div>
                </div>
            `:e+=`
                <div class="patron-detail-section" style="background:var(--bg2);border-radius:var(--radius);padding:0.8rem;border-left:4px solid var(--gold);">
                    <h3 style="margin:0 0 0.5rem 0;color:var(--gold);">🔮 Rites (${t.rites.length})</h3>
                    <ul style="margin:0;padding-left:1.2rem;list-style-type:disc;">
                        ${t.rites.map(r=>`<li>${n(s(r))}</li>`).join("")}
                    </ul>
                </div>
            `),t.runekeeper_options){const r=t.runekeeper_options;e+=`
            <div class="patron-detail-section" style="background:var(--bg2);border-radius:var(--radius);padding:0.8rem;border-left:4px solid var(--gold);">
                <h3 style="margin:0 0 0.3rem 0;color:var(--gold);">📜 Runekeeper Options</h3>
                ${r.thiasos?`
                    <div style="margin-bottom:0.5rem;">
                        <strong>🐾 Thiasos (Familiar):</strong>
                        <p style="margin:0.2rem 0;">${d(s(r.thiasos.description))}</p>
                        ${r.thiasos.care?`<p style="margin:0.2rem 0;font-size:0.85rem;color:var(--text3);"><strong>Care:</strong> ${d(s(r.thiasos.care))}</p>`:""}
                    </div>
                `:""}
                ${r.codex?`
                    <div>
                        <strong>📖 Codex:</strong>
                        <p style="margin:0.2rem 0;">${d(s(r.codex.description))}</p>
                        ${r.codex.upkeep?`<p style="margin:0.2rem 0;font-size:0.85rem;color:var(--text3);"><strong>Upkeep:</strong> ${d(s(r.codex.upkeep))}</p>`:""}
                    </div>
                `:""}
            </div>
        `}if(t.corruption&&t.corruption.length>0&&(e+=`
            <div class="patron-detail-section" style="background:var(--bg2);border-radius:var(--radius);padding:0.8rem;border-left:4px solid var(--red);">
                <h3 style="margin:0 0 0.3rem 0;color:var(--red);">⚠️ Corruption</h3>
                <table style="width:100%;border-collapse:collapse;font-size:0.85rem;">
                    <thead><tr style="border-bottom:2px solid var(--border);"><th style="text-align:left;padding:0.2rem 0.4rem;">Tier</th><th style="text-align:left;padding:0.2rem 0.4rem;">Benefit</th><th style="text-align:left;padding:0.2rem 0.4rem;">Cost / Quirk</th></tr></thead>
                    <tbody>${t.corruption.map(r=>`<tr style="border-bottom:1px solid var(--border);"><td style="padding:0.2rem 0.4rem;font-weight:600;">${n(s(r.tier))}</td><td style="padding:0.2rem 0.4rem;color:var(--gold);">${n(s(r.benefit))}</td><td style="padding:0.2rem 0.4rem;color:var(--red);">${n(s(r.cost))}</td></tr>`).join("")}</tbody>
                </table>
            </div>
        `),t.witchcraft){const r=t.witchcraft,o=r.color||"#27ae60";e+=`
            <div class="patron-detail-section" style="background:var(--bg2);border-radius:var(--radius);padding:0.8rem;border-left:4px solid ${o};">
                <h3 style="margin:0 0 0.3rem 0;color:${o};">🧹 ${r.name||"Witchcraft"}</h3>
                ${r.description?`<p style="margin:0.2rem 0;">${d(r.description)}</p>`:""}
                ${r.lore?`<p style="margin:0.2rem 0;font-size:0.85rem;color:var(--text2);">${d(r.lore)}</p>`:""}
                ${r.signature_rite?`<p style="margin:0.2rem 0;"><strong>Signature Rite:</strong> ${n(r.signature_rite)}</p>`:""}
                ${r.quote?`<blockquote style="margin:0.2rem 0;padding:0.3rem 0.8rem;background:var(--bg3);border-radius:var(--radius);border-left:3px solid ${o};font-size:0.85rem;">${d(r.quote)}</blockquote>`:""}
                ${r.tools?`
                    <div style="margin:0.3rem 0;"><strong>🛠️ Tools:</strong></div>
                    ${Object.entries(r.tools).map(([l,c])=>`
                        <div style="margin:0.1rem 0;padding:0.2rem 0.5rem;background:var(--bg3);border-radius:var(--radius);">
                            <strong>${n(c.name||l)}</strong>
                            <p style="margin:0.1rem 0;font-size:0.85rem;color:var(--text2);">${d(c.description)}</p>
                        </div>
                    `).join("")}
                `:""}
                ${r.hedge_gifts&&r.hedge_gifts.length>0?`
                    <div style="margin:0.3rem 0;"><strong>🌿 Hedge Gifts:</strong></div>
                    <ul style="margin:0;padding-left:1.2rem;list-style-type:disc;">
                        ${r.hedge_gifts.map(l=>`<li><strong>${n(s(l.name))}</strong> (${n(s(l.xp))} XP): ${d(s(l.description))}</li>`).join("")}
                    </ul>
                `:""}
            </div>
        `}if(t.monastic_tradition){const r=t.monastic_tradition,o=r.color||"#f39c12";e+=`
            <div class="patron-detail-section" style="background:var(--bg2);border-radius:var(--radius);padding:0.8rem;border-left:4px solid ${o};">
                <h3 style="margin:0 0 0.3rem 0;color:${o};">⛩️ ${r.name||"Monastic Tradition"}</h3>
                ${r.description?`<p style="margin:0.2rem 0;">${d(r.description)}</p>`:""}
                ${r.quote?`<blockquote style="margin:0.2rem 0;padding:0.3rem 0.8rem;background:var(--bg3);border-radius:var(--radius);border-left:3px solid ${o};font-size:0.85rem;">${d(r.quote)}</blockquote>`:""}
                ${r.prerequisites?`<p style="margin:0.2rem 0;"><strong>Prerequisites:</strong> ${n(r.prerequisites)}</p>`:""}
                ${r.debt_resistant_frame?`<p style="margin:0.2rem 0;color:var(--text2);">${d(r.debt_resistant_frame)}</p>`:""}
                ${r.techniques?`
                    <div style="margin:0.3rem 0;"><strong>Techniques:</strong></div>
                    ${["basic","advanced","master"].filter(l=>r.techniques[l]).map(l=>{const c=r.techniques[l],p=l.charAt(0).toUpperCase()+l.slice(1);return`
                            <div style="margin:0.1rem 0;padding:0.2rem 0.5rem;background:var(--bg3);border-radius:var(--radius);border-left:2px solid ${o};">
                                <strong>${p}: ${n(c.name)}</strong>
                                ${c.xp?`<span style="font-size:0.7rem;color:var(--text3);">(${c.xp} XP)</span>`:""}
                                <p style="margin:0.1rem 0;font-size:0.85rem;color:var(--text2);">${d(c.description)}</p>
                                ${c.cost?`<p style="margin:0.1rem 0;font-size:0.75rem;color:var(--text3);"><strong>Cost:</strong> ${d(c.cost)}</p>`:""}
                                ${c.prereq?`<p style="margin:0.1rem 0;font-size:0.75rem;color:var(--text3);"><strong>Requirement:</strong> ${n(c.prereq)}</p>`:""}
                            </div>
                        `}).join("")}
                `:""}
                ${r.master_technique?`
                    <div style="margin:0.3rem 0;padding:0.2rem 0.5rem;background:var(--bg3);border-radius:var(--radius);border-left:3px solid var(--gold);">
                        <strong>🏆 Master Technique: ${n(r.master_technique.name)}</strong>
                        ${r.master_technique.xp?`<span style="font-size:0.7rem;color:var(--text3);">(${r.master_technique.xp} XP)</span>`:""}
                        <p style="margin:0.1rem 0;font-size:0.85rem;color:var(--text2);">${d(r.master_technique.description)}</p>
                        ${r.master_technique.cost?`<p style="margin:0.1rem 0;font-size:0.75rem;color:var(--text3);"><strong>Cost:</strong> ${d(r.master_technique.cost)}</p>`:""}
                    </div>
                `:""}
                ${r.corruption&&r.corruption.length>0?`
                    <div style="margin:0.3rem 0;"><strong>⚠️ Tradition Corruption:</strong></div>
                    <table style="width:100%;border-collapse:collapse;font-size:0.75rem;">
                        <thead><tr style="border-bottom:1px solid var(--border);"><th style="text-align:left;padding:0.1rem 0.3rem;">Tier</th><th style="text-align:left;padding:0.1rem 0.3rem;">Benefit</th><th style="text-align:left;padding:0.1rem 0.3rem;">Cost</th></tr></thead>
                        <tbody>${r.corruption.map(l=>`<tr style="border-bottom:1px solid var(--border);"><td style="padding:0.1rem 0.3rem;">${n(s(l.tier))}</td><td style="padding:0.1rem 0.3rem;color:var(--gold);">${n(s(l.benefit))}</td><td style="padding:0.1rem 0.3rem;color:var(--red);">${n(s(l.cost))}</td></tr>`).join("")}</tbody>
                    </table>
                `:""}
            </div>
        `}if(t.cantors_and_cults){const r=t.cantors_and_cults;e+=`
            <div class="patron-detail-section" style="background:var(--bg2);border-radius:var(--radius);padding:0.8rem;border-left:4px solid var(--gold);">
                <h3 style="margin:0 0 0.3rem 0;color:var(--gold);">🎶 Cantors & Cults</h3>
                ${r.cantors?`
                    <div style="margin:0.2rem 0;">
                        <strong>🎵 ${r.cantors.name||"Cantors"}:</strong>
                        <p style="margin:0.1rem 0;">${d(s(r.cantors.description))}</p>
                    </div>
                `:""}
                ${r.cult?`
                    <div style="margin:0.2rem 0;">
                        <strong>🏛️ ${r.cult.name||"Cult"}:</strong>
                        <p style="margin:0.1rem 0;">${d(s(r.cult.description))}</p>
                    </div>
                `:""}
            </div>
        `}if(t.rivalries&&t.rivalries.length>0&&(e+=`
            <div class="patron-detail-section" style="background:var(--bg2);border-radius:var(--radius);padding:0.8rem;border-left:4px solid var(--orange);">
                <h3 style="margin:0 0 0.3rem 0;color:var(--orange);">⚔️ Rivalries</h3>
                ${t.rivalries.map(r=>`
                    <div style="margin:0.1rem 0;padding:0.2rem 0.5rem;background:var(--bg3);border-radius:var(--radius);">
                        <strong>${n(s(r.patron))}</strong>
                        <p style="margin:0.1rem 0;font-size:0.85rem;color:var(--text2);">${d(r.description)}</p>
                    </div>
                `).join("")}
            </div>
        `),t.playstyle_notes){const r=t.playstyle_notes;e+=`
            <div class="patron-detail-section" style="background:var(--bg2);border-radius:var(--radius);padding:0.8rem;border-left:4px solid var(--gold);">
                <h3 style="margin:0 0 0.3rem 0;color:var(--gold);">🎮 Playstyle Notes</h3>
                ${r.description?`<p style="margin:0.2rem 0;">${d(r.description)}</p>`:""}
                ${r.emphasizes&&r.emphasizes.length>0?`
                    <div style="margin:0.2rem 0;"><strong>Emphasizes:</strong></div>
                    <ul style="margin:0;padding-left:1.2rem;list-style-type:disc;">
                        ${r.emphasizes.map(o=>`<li>${d(o)}</li>`).join("")}
                    </ul>
                `:""}
            </div>
        `}if(t.sample_adventure){const r=t.sample_adventure;e+=`
            <div class="patron-detail-section" style="background:var(--bg2);border-radius:var(--radius);padding:0.8rem;border-left:4px solid var(--gold);">
                <h3 style="margin:0 0 0.3rem 0;color:var(--gold);">🎲 Sample Adventure</h3>
                ${r.title?`<p style="margin:0.2rem 0;"><strong>${n(r.title)}</strong></p>`:""}
                ${r.description?`<p style="margin:0.2rem 0;">${d(r.description)}</p>`:""}
                ${r.quote?`<blockquote style="margin:0.2rem 0;padding:0.3rem 0.8rem;background:var(--bg3);border-radius:var(--radius);border-left:3px solid var(--gold);font-size:0.85rem;">${d(r.quote)}</blockquote>`:""}
            </div>
        `}if(t.optional_campaign_arc){const r=t.optional_campaign_arc;e+=`
            <div class="patron-detail-section" style="background:var(--bg2);border-radius:var(--radius);padding:0.8rem;border-left:4px solid var(--purple);">
                <h3 style="margin:0 0 0.3rem 0;color:var(--purple);">🌅 Optional Campaign Arc</h3>
                ${r.title?`<p style="margin:0.2rem 0;"><strong>${n(r.title)}</strong></p>`:""}
                ${r.description?`<p style="margin:0.2rem 0;">${d(r.description)}</p>`:""}
                ${r.signs&&r.signs.length>0?`
                    <div style="margin:0.2rem 0;"><strong>Signs:</strong></div>
                    <ul style="margin:0;padding-left:1.2rem;list-style-type:disc;">
                        ${r.signs.map(o=>`<li>${d(o)}</li>`).join("")}
                    </ul>
                `:""}
                ${r.gm_guidance?`<p style="margin:0.2rem 0;font-size:0.85rem;color:var(--text2);"><strong>GM Guidance:</strong> ${d(r.gm_guidance)}</p>`:""}
            </div>
        `}if(t.temporary_anima_system){const r=t.temporary_anima_system;e+=`
            <div class="patron-detail-section" style="background:var(--bg2);border-radius:var(--radius);padding:0.8rem;border-left:4px solid var(--blue);">
                <h3 style="margin:0 0 0.3rem 0;color:var(--blue);">⚡ Temporary Anima System</h3>
                ${r.title?`<p style="margin:0.2rem 0;"><strong>${n(r.title)}</strong></p>`:""}
                ${r.description?`<p style="margin:0.2rem 0;">${d(r.description)}</p>`:""}
                ${r.core_principles&&r.core_principles.length>0?`
                    <div style="margin:0.2rem 0;"><strong>Core Principles:</strong></div>
                    <ul style="margin:0;padding-left:1.2rem;list-style-type:disc;">
                        ${r.core_principles.map(o=>`<li>${d(o)}</li>`).join("")}
                    </ul>
                `:""}
                ${r.effects&&r.effects.length>0?`
                    <div style="margin:0.2rem 0;"><strong>Effects:</strong></div>
                    <ul style="margin:0;padding-left:1.2rem;list-style-type:disc;">
                        ${r.effects.map(o=>`<li><strong>${n(o.name)}</strong>: ${d(o.effect)}</li>`).join("")}
                    </ul>
                `:""}
            </div>
        `}return e}window.viewTerrestrial=function(t){const e=i.terrestrialPatrons.find(o=>o.id===t);if(!e){u("Terrestrial patron not found","error");return}const r=document.getElementById("terrestrial-description-area");if(r){const o=E(e),l=s(e.name||e.title||"Unnamed"),c=A(e);r.innerHTML=`
            <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;">
                <span style="font-size:1.5rem;">${s(x(e)||"🏛️")}</span>
                <span style="font-weight:600;font-size:1.1rem;">${n(l)}</span>
                <span style="color:var(--text3);font-size:0.85rem;">${n(c)}</span>
                <button class="btn btn-xs btn-ghost" onclick="window.openTerrestrialDetailModal('${e.id}')" style="margin-left:auto;">📖 Full Details</button>
            </div>
            <div style="margin:0.3rem 0 0 0;color:var(--text2);font-size:0.9rem;line-height:1.5;overflow-y:auto;">
                ${d(o)}
            </div>
        `}};window.openTerrestrialDetailModal=function(t){const e=i.terrestrialPatrons.find(m=>m.id===t);if(!e){u("Terrestrial patron not found","error");return}const r=document.getElementById("patron-modal");r.style.display="block";const o=s(e.name||e.title||"Unnamed"),l=E(e),c=x(e)||"🏛️",p=s(e.type||e.agenda||"Terrestrial Patron"),a=s(e.tier||"I");r.innerHTML=`
        <div class="modal-content patron-detail" style="width: 90%; max-width: 800px; max-height: 90vh; overflow-y: auto; background:var(--bg1); padding:1.5rem; border-radius:var(--radius);">
            <button class="modal-close" onclick="window.closePatronModal()" style="float:right;background:none;border:none;font-size:1.5rem;cursor:pointer;color:var(--text3);">✕</button>
            <div class="patron-detail-header" style="display:flex;align-items:center;gap:1rem;margin-bottom:1rem;border-bottom:1px solid var(--border);padding-bottom:0.5rem;">
                <div style="font-size:3rem;">${n(c)}</div>
                <div>
                    <h2 style="margin:0;color:var(--gold);">${n(o)}</h2>
                    <div style="color:var(--text2);">${n(p)}</div>
                    <div style="color:var(--text3);">Tier ${n(a)}</div>
                </div>
            </div>
 
            <div class="patron-detail-body" style="display:flex;flex-direction:column;gap:0.8rem;">
                ${l?`
                    <div class="patron-detail-section" style="background:var(--bg2);border-radius:var(--radius);padding:0.8rem;border-left:4px solid var(--blue);">
                        <h3 style="margin:0 0 0.3rem 0;color:var(--blue);">📖 Description</h3>
                        <p style="margin:0;white-space:pre-wrap;">${d(l)}</p>
                    </div>
                `:""}
                ${e.location?`
                    <div class="patron-detail-section" style="background:var(--bg2);border-radius:var(--radius);padding:0.8rem;border-left:4px solid var(--blue);">
                        <h3 style="margin:0 0 0.3rem 0;color:var(--blue);">📍 Location</h3>
                        <p style="margin:0;">${n(e.location)}</p>
                    </div>
                `:""}
                ${e.leverage?`
                    <div class="patron-detail-section" style="background:var(--bg2);border-radius:var(--radius);padding:0.8rem;border-left:4px solid var(--blue);">
                        <h3 style="margin:0 0 0.3rem 0;color:var(--blue);">💰 Leverage</h3>
                        <p style="margin:0;">${n(e.leverage)}</p>
                    </div>
                `:""}
                ${e.debtTrigger?`
                    <div class="patron-detail-section" style="background:var(--bg2);border-radius:var(--radius);padding:0.8rem;border-left:4px solid var(--blue);">
                        <h3 style="margin:0 0 0.3rem 0;color:var(--blue);">⚡ Debt Trigger</h3>
                        <p style="margin:0;">${n(e.debtTrigger)}</p>
                    </div>
                `:""}
                ${e.quirk?`
                    <div class="patron-detail-section" style="background:var(--bg2);border-radius:var(--radius);padding:0.8rem;border-left:4px solid var(--blue);">
                        <h3 style="margin:0 0 0.3rem 0;color:var(--blue);">🌀 Quirk</h3>
                        <p style="margin:0;">${n(e.quirk)}</p>
                    </div>
                `:""}
                <div class="patron-detail-section" style="background:var(--bg2);border-radius:var(--radius);padding:0.8rem;border-left:4px solid var(--blue);">
                    <h3 style="margin:0 0 0.3rem 0;color:var(--blue);">📊 Stats</h3>
                    <ul style="margin:0;padding-left:1.2rem;list-style-type:disc;">
                        <li>Asset Slots: ${n(e.assetSlots||0)}</li>
                        <li>Max Asset Tier: ${n(e.maxAssetTier||"Minor")}</li>
                        <li>Obligation Capacity: ${n(e.obligationCapacity||"Spirit+Presence")}</li>
                    </ul>
                </div>
                ${e.agendaTimer?`
                    <div class="patron-detail-section" style="background:var(--bg2);border-radius:var(--radius);padding:0.8rem;border-left:4px solid var(--blue);">
                        <h3 style="margin:0 0 0.3rem 0;color:var(--blue);">⏱️ Agenda Timer</h3>
                        <div style="margin:0.3rem 0;">${s(e.agendaTimer.current||0)}/${s(e.agendaTimer.segments||6)}</div>
                        <div class="timer-bar" style="width:100%;height:6px;background:var(--bg3);border-radius:3px;overflow:hidden;">
                            <div class="timer-bar-fill" style="height:100%;width:${(e.agendaTimer?.current||0)/(e.agendaTimer?.segments||6)*100}%;background:var(--gold);"></div>
                        </div>
                    </div>
                `:""}
                ${e.keyNPCs&&e.keyNPCs.length>0?`
                    <div class="patron-detail-section" style="background:var(--bg2);border-radius:var(--radius);padding:0.8rem;border-left:4px solid var(--blue);">
                        <h3 style="margin:0 0 0.3rem 0;color:var(--blue);">👤 Key NPCs</h3>
                        <ul style="margin:0;padding-left:1.2rem;list-style-type:disc;">
                            ${e.keyNPCs.map(m=>`<li>${n(s(m))}</li>`).join("")}
                        </ul>
                    </div>
                `:""}
                ${e.hooks&&e.hooks.length>0?`
                    <div class="patron-detail-section" style="background:var(--bg2);border-radius:var(--radius);padding:0.8rem;border-left:4px solid var(--blue);">
                        <h3 style="margin:0 0 0.3rem 0;color:var(--blue);">🔗 Hooks</h3>
                        <ul style="margin:0;padding-left:1.2rem;list-style-type:disc;">
                            ${e.hooks.map(m=>`<li>${n(s(m))}</li>`).join("")}
                        </ul>
                    </div>
                `:""}
            </div>
 
            <div class="patron-detail-actions" style="display:flex;gap:0.5rem;margin-top:1rem;border-top:1px solid var(--border);padding-top:0.5rem;">
                <button class="btn btn-sm" onclick="window.editTerrestrial('${e.id}')">✏️ Edit</button>
                <button class="btn btn-sm btn-danger" onclick="window.deleteTerrestrial('${e.id}')">🗑️ Delete</button>
                <button class="btn btn-sm btn-secondary" onclick="window.closePatronModal()">Close</button>
            </div>
        </div>
    `,r.onclick=m=>{m.target===r&&window.closePatronModal()}};window.viewReligion=function(t){const e=i.religions.find(o=>o.id===t);if(!e){u("Religion not found","error");return}const r=document.getElementById("patron-modal");r.style.display="block",r.innerHTML=`
        <div class="modal-content" style="width:90%;max-width:600px;max-height:90vh;overflow-y:auto;background:var(--bg1);padding:1.5rem;border-radius:var(--radius);">
            <button class="modal-close" onclick="window.closePatronModal()" style="float:right;background:none;border:none;font-size:1.5rem;cursor:pointer;color:var(--text3);">✕</button>
            <h2 style="color:var(--gold);">${n(e.name)}</h2>
            <div style="font-size:1.5rem;">${s(e.icon||"⛪")}</div>
            ${e.description?`<p>${d(e.description)}</p>`:""}
            ${e.lore?`<p><strong>Lore:</strong> ${d(e.lore)}</p>`:""}
            ${e.doctrines?`<div><strong>Doctrines:</strong><ul>${e.doctrines.map(o=>`<li>${n(o)}</li>`).join("")}</ul></div>`:""}
            ${e.practices?`<div><strong>Practices:</strong><ul>${e.practices.map(o=>`<li>${n(o)}</li>`).join("")}</ul></div>`:""}
            ${e.orders?`<div><strong>Orders:</strong><ul>${e.orders.map(o=>`<li>${n(o.name)} (${n(o.role)})</li>`).join("")}</ul></div>`:""}
            <button class="btn btn-sm btn-secondary" onclick="window.closePatronModal()" style="margin-top:0.5rem;">Close</button>
        </div>
    `,r.onclick=o=>{o.target===r&&window.closePatronModal()}};window.viewTrust=function(t){const e=i.trusts.find(o=>o.id===t);if(!e){u("Trust not found","error");return}const r=document.getElementById("patron-modal");r.style.display="block",r.innerHTML=`
        <div class="modal-content" style="width:90%;max-width:600px;max-height:90vh;overflow-y:auto;background:var(--bg1);padding:1.5rem;border-radius:var(--radius);">
            <button class="modal-close" onclick="window.closePatronModal()" style="float:right;background:none;border:none;font-size:1.5rem;cursor:pointer;color:var(--text3);">✕</button>
            <h2 style="color:var(--gold);">${n(e.name)}</h2>
            <div style="font-size:1.5rem;">${s(e.icon||"🤝")}</div>
            <div>Tier ${n(e.tier||"I")}</div>
            ${e.description?`<p>${d(e.description)}</p>`:""}
            <div><strong>Obligation:</strong> ${e.obligation||0}/${e.capacity||4}</div>
            <div><strong>Assets:</strong> ${e.assets?.length||0}</div>
            <div><strong>Followers:</strong> ${e.followers?.length||0}</div>
            <button class="btn btn-sm btn-secondary" onclick="window.closePatronModal()" style="margin-top:0.5rem;">Close</button>
        </div>
    `,r.onclick=o=>{o.target===r&&window.closePatronModal()}};window.closePatronModal=function(){document.getElementById("patron-modal").style.display="none"};window.closeAssetModal=function(){document.getElementById("asset-modal").style.display="none"};window.viewPatron=function(t){H(t);const e=document.getElementById("patron-modal");e&&e.style.display!=="none"&&window.openPatronDetailModal(t)};window.addPatronObligation=function(t,e,r=1){N(t,e,r),i.cosmicPatrons.find(o=>o.id===e)&&H(e),u(`Added ${r} Obligation to ${e}`,"success")};window.clearPatronObligation=function(t,e,r=1){U(t,e,r),i.cosmicPatrons.find(o=>o.id===e)&&H(e),u(`Cleared ${r} Obligation from ${e}`,"info")};window.addCosmicPatron=function(){const t=prompt("Enter patron name:");if(!t)return;const e=prompt("Enter patron domain:")||"Unknown",r=prompt("Enter patron icon (emoji):")||"🌟";i.cosmicPatrons.push(h({id:"patron-"+Date.now(),name:t,domain:e,icon:r,description:prompt("Enter description:")||"A cosmic patron of the Amaranthine.",rites:prompt("Enter rites (comma-separated):")?.split(",").map(o=>o.trim())||[],rivals:prompt("Enter rivals (comma-separated):")?.split(",").map(o=>o.trim())||[],sigil:prompt("Enter sigil description:")||"Unknown",corruption:prompt("Enter corruption effect:")||"None",source:"local"})),i.cosmicPatrons.sort(f),b(),v(),u(`Added patron: ${t}`,"success")};window.editPatron=function(t){const e=i.cosmicPatrons.find(o=>o.id===t);if(!e)return;const r=prompt("Enter patron name:",e.name||e.title);r&&(e.name=r,e.title=r,e.domain=prompt("Enter patron domain:",e.domain||e.subtitle)||e.domain,e.icon=prompt("Enter patron icon:",e.icon)||e.icon,e.description=prompt("Enter description:",e.description)||e.description,e.sigil=prompt("Enter sigil:",e.sigil)||e.sigil,e.corruption=prompt("Enter corruption:",e.corruption)||e.corruption,e.source="local",i.cosmicPatrons.sort(f),b(),v(),window.closePatronModal(),u(`Updated patron: ${r}`,"success"))};window.deletePatron=function(t){const e=i.cosmicPatrons.find(r=>r.id===t);e&&confirm(`Delete patron "${e.name||e.title}"?`)&&(i.cosmicPatrons=i.cosmicPatrons.filter(r=>r.id!==t),i.cosmicPatrons.sort(f),b(),v(),window.closePatronModal(),u(`Deleted patron: ${e.name||e.title}`,"info"))};window.addTerrestrialPatron=function(){const t=prompt("Enter terrestrial patron name:");t&&(i.terrestrialPatrons.push(h({id:"terr-"+Date.now(),name:t,type:prompt("Enter type (creditor/fence/sanctuary/military/tribal):")||"patron",tier:prompt("Enter tier (I-V):")||"I",description:prompt("Enter description:")||"A terrestrial patron of the Amaranthine.",location:prompt("Enter location:")||"Unknown",leverage:prompt("Enter leverage:")||"None listed",debtTrigger:prompt("Enter debt trigger:")||"When Obligation fills, they call in a debt.",quirk:prompt("Enter quirk:")||"",assetSlots:parseInt(prompt("Enter asset slots:")||"2"),maxAssetTier:prompt("Enter max asset tier (Minor/Standard/Major):")||"Minor",obligationCapacity:prompt("Enter obligation capacity (Spirit+Presence or fixed):")||"Spirit+Presence",source:"local"})),i.terrestrialPatrons.sort(f),b(),v(),u(`Added terrestrial patron: ${t}`,"success"))};window.editTerrestrial=function(t){const e=i.terrestrialPatrons.find(o=>o.id===t);if(!e)return;const r=prompt("Enter name:",e.name||e.title);r&&(e.name=r,e.title=r,e.type=prompt("Enter type:",e.type)||e.type,e.tier=prompt("Enter tier:",e.tier)||e.tier,e.description=prompt("Enter description:",e.description)||e.description,e.location=prompt("Enter location:",e.location)||e.location,e.leverage=prompt("Enter leverage:",e.leverage)||e.leverage,e.debtTrigger=prompt("Enter debt trigger:",e.debtTrigger)||e.debtTrigger,e.quirk=prompt("Enter quirk:")||e.quirk,e.assetSlots=parseInt(prompt("Enter asset slots:",e.assetSlots)||"2"),e.maxAssetTier=prompt("Enter max asset tier:",e.maxAssetTier)||e.maxAssetTier,e.obligationCapacity=prompt("Enter obligation capacity:",e.obligationCapacity)||e.obligationCapacity,e.source="local",i.terrestrialPatrons.sort(f),b(),v(),window.closePatronModal(),u(`Updated terrestrial patron: ${r}`,"success"))};window.deleteTerrestrial=function(t){const e=i.terrestrialPatrons.find(r=>r.id===t);e&&confirm(`Delete terrestrial patron "${e.name||e.title}"?`)&&(i.terrestrialPatrons=i.terrestrialPatrons.filter(r=>r.id!==t),i.terrestrialPatrons.sort(f),b(),v(),window.closePatronModal(),u(`Deleted terrestrial patron: ${e.name||e.title}`,"info"))};window.addReligion=function(){const t=prompt("Enter religion name:");if(!t)return;const e=prompt("Enter icon (emoji):")||"⛪";i.religions.push({id:"religion-"+Date.now(),name:t,icon:e,description:prompt("Enter description:")||"A religion of the Amaranthine.",lore:prompt("Enter lore:")||"",doctrines:prompt("Enter doctrines (comma-separated):")?.split(",").map(r=>r.trim())||[],practices:prompt("Enter practices (comma-separated):")?.split(",").map(r=>r.trim())||[],orders:[],source:"local"}),i.religions.sort(f),b(),v(),u(`Added religion: ${t}`,"success")};window.editReligion=function(t){const e=i.religions.find(o=>o.id===t);if(!e)return;const r=prompt("Enter religion name:",e.name);r&&(e.name=r,e.icon=prompt("Enter icon:",e.icon)||e.icon,e.description=prompt("Enter description:",e.description)||e.description,e.lore=prompt("Enter lore:",e.lore)||e.lore,e.doctrines=prompt("Enter doctrines (comma-separated):",e.doctrines.join(","))?.split(",").map(o=>o.trim())||[],e.practices=prompt("Enter practices (comma-separated):",e.practices.join(","))?.split(",").map(o=>o.trim())||[],e.source="local",i.religions.sort(f),b(),v(),window.closePatronModal(),u(`Updated religion: ${r}`,"success"))};window.deleteReligion=function(t){const e=i.religions.find(r=>r.id===t);e&&confirm(`Delete religion "${e.name}"?`)&&(i.religions=i.religions.filter(r=>r.id!==t),i.religions.sort(f),b(),v(),window.closePatronModal(),u(`Deleted religion: ${e.name}`,"info"))};window.addTrust=function(){const t=prompt("Enter trust name:");t&&(i.trusts.push({id:"trust-"+Date.now(),name:t,icon:prompt("Enter icon (emoji):")||"🤝",tier:prompt("Enter tier (I-III):")||"I",description:prompt("Enter description:")||"A player trust formed by the party.",maxAssets:parseInt(prompt("Enter max asset slots:")||"2"),maxAssetTier:prompt("Enter max asset tier (Minor/Standard/Major):")||"Standard",assets:[],followers:[],obligation:0,capacity:parseInt(prompt("Enter obligation capacity:")||"4"),source:"local"}),i.trusts.sort(f),b(),v(),u(`Created trust: ${t}`,"success"))};window.editTrust=function(t){const e=i.trusts.find(o=>o.id===t);if(!e)return;const r=prompt("Enter trust name:",e.name);r&&(e.name=r,e.icon=prompt("Enter icon:",e.icon)||e.icon,e.tier=prompt("Enter tier:",e.tier)||e.tier,e.description=prompt("Enter description:",e.description)||e.description,e.maxAssets=parseInt(prompt("Enter max asset slots:",e.maxAssets)||"2"),e.maxAssetTier=prompt("Enter max asset tier:",e.maxAssetTier)||e.maxAssetTier,e.capacity=parseInt(prompt("Enter obligation capacity:",e.capacity)||"4"),e.source="local",i.trusts.sort(f),b(),v(),window.closePatronModal(),u(`Updated trust: ${r}`,"success"))};window.deleteTrust=function(t){const e=i.trusts.find(r=>r.id===t);e&&confirm(`Delete trust "${e.name}"?`)&&(i.trusts=i.trusts.filter(r=>r.id!==t),i.trusts.sort(f),b(),v(),window.closePatronModal(),u(`Deleted trust: ${e.name}`,"info"))};window.runPatronRecommender=function(){const t=document.getElementById("patron-recommender-input");if(!t)return;const e=t.value.trim();if(!e){u('Describe a character concept first — e.g. "a nature-loving druid".',"info");return}const r=pe(e,i.cosmicPatrons);i.recommender.query=e,i.recommender.results=r,i.recommender.active=!0,r.length===0?u(`No patrons matched "${e}". Showing the full list — try different words.`,"info"):u(`🔮 Found ${r.length} match${r.length===1?"":"es"}.`,"success"),v()};window.clearPatronRecommender=function(){i.recommender.query="",i.recommender.results=null,i.recommender.active=!1,v()};window.refreshPatrons=function(){localStorage.removeItem("fates-edge-patrons-cache-cosmic"),localStorage.removeItem("fates-edge-patrons-cache-terrestrial"),localStorage.removeItem("fates-edge-patrons-cache-religion");const t=j();t.patrons&&(delete t.patrons.cosmic,delete t.patrons.terrestrial,delete t.patrons.religions,Q()),i.cosmicPatrons=[],i.terrestrialPatrons=[],i.religions=[],i.dataLoaded=!1,i.usingFallback=!1,i.recommender.results=null,i.recommender.active=!1,k(!0),v(),u("🔄 Patrons refreshed from disk","success")};window.loadDefaultPatrons=function(){O(),v(),u("Loaded default patrons","success")};function v(){const t=document.getElementById("patrons-view-container");t&&(t.innerHTML=F(i.viewMode)),z()}function z(){document.querySelectorAll(".patrons-tab").forEach(t=>{t.addEventListener("click",()=>{document.querySelectorAll(".patrons-tab").forEach(o=>o.classList.remove("active")),t.classList.add("active");const e=t.dataset.view,r=document.getElementById("patrons-view-container");r&&(r.innerHTML=F(e),z())})})}function ie(){console.log("[Patrons] Activated"),i.dataLoaded||k(),v()}function oe(){console.log("[Patrons] Deactivated")}function ne(){localStorage.removeItem("fates-edge-patrons-cache-cosmic"),localStorage.removeItem("fates-edge-patrons-cache-terrestrial"),localStorage.removeItem("fates-edge-patrons-cache-religion"),k(!0),v()}function se(){D=null}function ae(){$=!0,v(),u("🔮 The Ninth has revealed itself to you.","info")}function le(){return $}var Pe={render:re,destroy:se,onActivate:ie,onDeactivate:oe,refresh:ne,loadPatronData:k,loadRemotePatrons:te,loadDefaultPatrons:O,savePatronData:b,getPatronObligation:P,setPatronObligation:S,addPatronObligation:N,clearPatronObligation:U,revealNinth:ae,isNinthRevealed:le};export{Pe as n,ze as r,k as t};
