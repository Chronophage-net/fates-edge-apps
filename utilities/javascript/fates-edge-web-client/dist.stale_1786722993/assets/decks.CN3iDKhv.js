const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/sync.i5xh8ufD.js","assets/rolldown-runtime.BQ-_32WO.js","assets/state.42sFgcOQ.js","assets/utils.lBShoim5.js","assets/Toast.DDAtBIAw.js","assets/timers.DECKYaq0.js","assets/websocket.Dmklt06W.js","assets/preload-helper.BATLnrmA.js","assets/main.hiOZSyFC.js","assets/main.DcCFXHiG.css"])))=>i.map(i=>d[i]);
import{t as Ge}from"./rolldown-runtime.BQ-_32WO.js";import"./utils.lBShoim5.js";import{b as xe}from"./state.42sFgcOQ.js";import{n as y}from"./Toast.DDAtBIAw.js";import{t as Te}from"./preload-helper.BATLnrmA.js";import{p as L,y as h}from"./main.hiOZSyFC.js";import{r as se}from"./discovery.I-q7Uafb.js";function Ke(e){return e?Fe(Pe(e)):""}function Pe(e){const t=[],r=e.match(/<h1[^>]*>(.*?)<\/h1>/);r&&t.push({type:"heading",text:r[1]});const n=/<p class="region-text">(.*?)<\/p>/gs;let i;for(;(i=n.exec(e))!==null;)t.push({type:"paragraph",text:i[1].trim()});return t.length===0&&e.replace(/<br\s*\/?>/gi,`
`).replace(/<[^>]+>/g,`
`).trim().split(`
`).forEach(o=>{const a=o.trim();a&&t.push({type:"paragraph",text:a})}),t}function Fe(e){let t="",r=!1;for(let n=0;n<e.length;n++){const{type:i,text:o}=e[n];if(i==="heading"){t+=`<h2 class="region-title">${o}</h2>
`;continue}const a=o.match(/^\[colback=[^,\]]+,colframe=[^,\]]+,title=\{([^,]+),breakable\]\s*(.*)$/);if(a){r&&(t+=`</div></div>
`);const c=a[1].trim(),d=a[2].trim();t+=`<div class="region-box">
<div class="region-box-title">${c}</div>
<div class="region-box-content">
`,r=!0,d&&(d.startsWith("*{")?t+=re(d.slice(2)):t+=`<p>${S(d)}</p>
`);continue}if(o.startsWith("*{")){const c=o.slice(2),d=c.search(/(?:tabular|longtable)\{/);if(d!==-1){const v=c.slice(0,d).trim();v&&(t+=re(v));const x=[];for(n++;n<e.length;){const $=e[n].text.trim();if($==="tabular"||$==="longtable"){n++;break}x.push($),n++}t+=Se(x);continue}t+=re(c);continue}if(o.match(/^(?:tabular|longtable)\{/)){const c=[];for(n++;n<e.length;){const d=e[n].text.trim();if(d==="tabular"||d==="longtable"){n++;break}c.push(d),n++}t+=Se(c);continue}if(o==="tabular"||o==="longtable")continue;const l=o.match(/^(.*?)itemize\s+([\s\S]+?)\s+itemize(.*)$/);if(l){const c=l[1].trim(),d=l[2],v=l[3].trim();c&&(t+=`<p>${S(c)}</p>
`);const x=Ve(d);t+=`<ul class="region-list">
`,x.forEach($=>{t+=`  <li>${S($)}</li>
`}),t+=`</ul>
`,v&&(t+=$e(v,n,e));continue}const s=o.match(/^(.*?)enumerate\s+([\s\S]+?)\s+enumerate(.*)$/);if(s){const c=s[1].trim(),d=s[2],v=s[3].trim();c&&(t+=`<p>${S(c)}</p>
`);const x=Qe(d);t+=`<ol class="region-list">
`,x.forEach($=>{t+=`  <li>${S($)}</li>
`}),t+=`</ol>
`,v&&(t+=$e(v,n,e));continue}const u=o.match(/^quote\s+([\s\S]+?)\s+quote$/);if(u){const c=u[1],d=c.match(/^([^:]+):\s*"([\s\S]*)"$/);d?t+=`<blockquote class="region-quote">
<div class="quote-speaker">${d[1].trim()}</div>
<div class="quote-text">"${d[2]}"</div>
</blockquote>
`:t+=`<blockquote class="region-quote">${S(c)}</blockquote>
`;continue}t+=`<p>${S(o)}</p>
`}return r&&(t+=`</div></div>
`),t}function $e(e,t,r){let n="";return e.split(/(?=At \d+ segments:)/).forEach(i=>{const o=i.trim();o&&(o.match(/^At \d+ segments:/)?n+=`<p class="region-note">${S(o)}</p>
`:n+=`<p>${S(o)}</p>
`)}),n}function re(e){const t=e.indexOf(":");if(t>0&&t<40&&!e.slice(0,t).includes("("))return`<h4 class="region-section-heading">${S(e)}</h4>
`;if(e.length<60&&e.split(/\s+/).length<=6)return`<h4 class="region-section-heading">${S(e)}</h4>
`;const r=e.split(/\s+/);if(r.length>4){const n=r.slice(0,2).join(" "),i=r.slice(2).join(" ");return`<div class="region-section"><span class="region-label">${S(n)}</span> <span class="region-desc">${S(i)}</span></div>
`}return`<h4 class="region-section-heading">${S(e)}</h4>
`}function Se(e){if(e.length===0)return"";let t=`<table class="region-table">
<thead><tr>${e[0].split("&").map(r=>r.trim()).map(r=>`<th>${S(r)}</th>`).join("")}</tr></thead>
<tbody>
`;for(let r=1;r<e.length;r++){const n=e[r].split("&").map(i=>i.trim()).map(i=>`<td>${S(i)}</td>`).join("");t+=`<tr>${n}</tr>
`}return t+=`</tbody>
</table>
`,t}function Ve(e){const t=[];let r=e;for(;;){const n=r.match(/\)\s+(?=[A-Z])/);if(!n){t.push(r);break}const i=n.index;t.push(r.slice(0,i+1)),r=r.slice(i+n[0].length)}return t.map(n=>n.trim()).filter(n=>n)}function Qe(e){const t=[];let r=e;for(;;){const n=r.match(/\.\s+(?=A |The |An |In |On )/);if(!n){t.push(r);break}const i=n.index;t.push(r.slice(0,i+1)),r=r.slice(i+n[0].length)}return t.map(n=>n.trim()).filter(n=>n)}function S(e){let t=e;return t=t.replace(/``([^']*?)''/g,"<em>$1</em>"),t=t.replace(/---/g,"—"),t=t.replace(/--/g,"–"),t=t.replace(/&(?!amp;|lt;|gt;|quot;|#)/g,"&amp;"),t}var $t=Ge({attachEvents:()=>fe,default:()=>pt,destroy:()=>He,drawConsequence:()=>X,generateDeckSeed:()=>De,getCardMeaning:()=>Oe,getDeckHistory:()=>Le,getDeckSeed:()=>et,getRegionData:()=>We,getRegionNames:()=>ye,getRegionSlug:()=>_e,getSelectedRegion:()=>he,onActivate:()=>Be,onDeactivate:()=>Je,onRegionChange:()=>ve,openCrownSpread:()=>pe,quickCrownSpread:()=>be,quickDraw:()=>we,refresh:()=>qe,registerRegionChange:()=>te,render:()=>V,resetDeck:()=>ee,setDeckSeed:()=>ae,setSelectedRegion:()=>q}),F="./data/regions",Ae=["hearts","spades","clubs","diamonds"],Ye=["A","2","3","4","5","6","7","8","9","10","J","Q","K"],le={hearts:"♥",spades:"♠",clubs:"♣",diamonds:"♦"},ce={hearts:"#c0392b",spades:"#2c3e50",clubs:"#27ae60",diamonds:"#2980b9"},U={hearts:"Hearts",spades:"Spades",clubs:"Clubs",diamonds:"Diamonds"},G={A:"Ace",2:"Two",3:"Three",4:"Four",5:"Five",6:"Six",7:"Seven",8:"Eight",9:"Nine",10:"Ten",J:"Jack",Q:"Queen",K:"King"},Ee={hearts:{label:"Actor",desc:"a person, faction, or relationship that drives the scene"},spades:{label:"Location",desc:"a place, terrain, or environmental feature"},clubs:{label:"Complication",desc:"an obstacle, danger, or twist"},diamonds:{label:"Reward/Leverage",desc:"a resource, opportunity, or material gain"}},je={2:{tier:"Minor",segments:4},3:{tier:"Minor",segments:4},4:{tier:"Minor",segments:4},5:{tier:"Minor",segments:4},6:{tier:"Medium",segments:6},7:{tier:"Medium",segments:6},8:{tier:"Medium",segments:6},9:{tier:"Medium",segments:6},10:{tier:"Major",segments:8},J:{tier:"Major",segments:8},Q:{tier:"Major",segments:8},K:{tier:"Major",segments:8},A:{tier:"Ace",segments:10}},ie={A:14,K:13,Q:12,J:11,10:10,9:9,8:8,7:7,6:6,5:5,4:4,3:3,2:2},Ce={spades:4,hearts:3,diamonds:2,clubs:1},Ze=["A sudden storm or environmental shift changes the scene.","An unexpected ally appears with conflicting motives.","A minor curse or blessing from a Patron alters the odds.","A forgotten debt is called in at the worst moment.","The ground beneath you gives way—literal or figurative.","A piece of evidence surfaces that reframes everything.","A rival's plan backfires, creating chaos for everyone.","A moment of clarity reveals a hidden truth."],Xe=[{key:"root",label:"Root",icon:"🌱",desc:"The underlying tension or theme of the situation.",interpretive:"What has been growing beneath the surface? What unresolved debt, hidden grudge, or quiet truth has brought you to this moment?"},{key:"crest",label:"Crest",icon:"🏔️",desc:"A key faction, patron, or influence that will rise.",interpretive:"What power is gathering strength? Who or what will demand your attention—and what will they ask of you?"},{key:"crown",label:"Crown",icon:"👑",desc:"The climax image or major confrontation.",interpretive:"What is the shape of the storm that awaits? What must you face, and what will it cost to meet it?"},{key:"left",label:"Left Hand",icon:"🤝",desc:"A bond, ally, or relationship that anchors play.",interpretive:"Who stands with you? What connection will be tested—and what will it take to keep it whole?"}],P={generic:[{emoji:"👻",text:"The Hollow takes notice. A pale figure watches from the corner of your eye."},{emoji:"🔔",text:"A bell rings without being struck. The ninth chime is silent."},{emoji:"🌫️",text:"Mist rolls in, carrying whispers of a debt unpaid."},{emoji:"🕯️",text:"A candle gutters and relights itself, burning blue."},{emoji:"🃏",text:"The Joker's wildcard manifests — the unexpected becomes inevitable."},{emoji:"🌙",text:"The moon flickers. For a moment, you see two shadows."},{emoji:"⚖️",text:"A scale appears in the air, weighing something you cannot see."},{emoji:"🕸️",text:"A spider web glistens in the corner, its threads forming a pattern you almost recognize."},{emoji:"🗝️",text:"A key falls from an empty pocket. It unlocks a door you haven't found yet."},{emoji:"🦉",text:"An owl lands and watches you, unblinking. It does not fly away when you approach."},{emoji:"🍷",text:"A cup of wine spills, but the stain forms a map that wasn't there a moment ago."},{emoji:"🍂",text:"A dead leaf falls upward, pointing toward a hidden path."}],acasia:[{emoji:"🌿",text:"The Curse stirs. A crossroads behind you now leads to a place you have already been."},{emoji:"🪦",text:"A broken milestone weeps rust. The empire's ghost is counting."},{emoji:"🔥",text:"A free company's banner flickers in the distance, its colors changed."}],ecktoria:[{emoji:"🏛️",text:"A statue turns its head to watch you. The marble is warm."},{emoji:"⚜️",text:"A seal appears on your documents that you did not stamp. The Vigil is watching."},{emoji:"🔥",text:"The Everflame burns blue. A forgotten precedent surfaces."}],vhasia:[{emoji:"☀️",text:"The sun fractures. You see a reflection of Lence in every mirror."},{emoji:"🗡️",text:"A knight's gorget unbuckles on its own. Chivalry is a weight."},{emoji:"👑",text:"A crown sits on a throne that was empty a moment ago. The claimant is watching."}],viterra:[{emoji:"🌳",text:"A hedge grows where no hedge was before. The boundary has moved."},{emoji:"⚖️",text:"A legal duel is declared in your name. You have one hour to prepare."},{emoji:"🛡️",text:"The Queen's Justiciar passes by. She does not see you—yet."}],ykrul:[{emoji:"🐺",text:"A wolf howls in the distance. The steppe is counting its debts."},{emoji:"🌾",text:"A white squall approaches. The wind carries the names of the dead."},{emoji:"⚔️",text:"A hostage string is cut. A feud rekindles."}],silkstrand:[{emoji:"🌊",text:"The canals run red. The dye-water curse awakens."},{emoji:"🕊️",text:"A bridge token appears in your pocket. No one knows who left it."},{emoji:"📜",text:"A contract is voided in invisible ink. You owe nothing—and everything."}],mistlands:[{emoji:"🔔",text:"A bell-line fails. Something steps through the gap."},{emoji:"🧂",text:"The salt pans turn gray. The wards are weakening."},{emoji:"🌫️",text:"The mist takes a name. You feel lighter."}],thepyrgos:[{emoji:"🔑",text:"A stair appears where none should be. The Unfinished Stair calls."},{emoji:"📚",text:"An archive shelf unlocks itself. A forbidden truth is revealed."},{emoji:"🔔",text:"A bell tolls nine times. The Synod is in session."}],ubral:[{emoji:"🪨",text:"A cairn adds a new stone. The dead have voted."},{emoji:"⚔️",text:"A guest-right is broken. Blood will answer."},{emoji:"🐎",text:"A riderless horse appears on the ridge. It waits for you."}],valewood:[{emoji:"🌲",text:"A star-road phases into existence. The forest remembers."},{emoji:"🍃",text:"A leaf falls upward, pointing to a hidden threshold."},{emoji:"👑",text:"The Hazel Queen's laughter echoes through the trees."}],aelinnel:[{emoji:"🔮",text:"A geas forms on your tongue. Choose your next words carefully."},{emoji:"🌿",text:"The Green Gate opens at the wrong hour. Roads rewire."},{emoji:"🕊️",text:"A fae courtier offers a gift. Accepting may cost more than you know."}],aelaerem:[{emoji:"🍎",text:"The Hollow walks. The ninth cup is poured."},{emoji:"🐦",text:"The watch-geese fall silent. Someone is coming."},{emoji:"🌾",text:"The scarecrow turns to face you. It knows your name."}],aeler:[{emoji:"⛏️",text:"The mountain shifts. A knock in threes echoes from the deep."},{emoji:"🕯️",text:"A lamplighter's wick fails for no reason. The dark is listening."},{emoji:"🌬️",text:"The air grows thin. Count your breaths, or the pressure will count them for you."}],zakov:[{emoji:"🌊",text:"The tide turns early. The reef is hungry."},{emoji:"💎",text:"A crystalline shard glows in the dark. The Reaping stirs."},{emoji:"🏴‍☠️",text:"The Salt Prince raises the levy. Every ship pays."}],kahfagia:[{emoji:"🔦",text:"A beacon gutters. The Admiralty has changed the channel."},{emoji:"🕸️",text:"A silk thread appears on your rigging. The Spider is watching."},{emoji:"🌊",text:"The tide turns twice in one day. The sea is unsettled."}]},w={seed:null,prng:null},Q=class{constructor(e){this.seed=e,this.state=this._seedToState(e)}_seedToState(e){let t=0,r=0;if(typeof e=="number")t=e,r=e+114007148193232e5;else if(typeof e=="string"){let n=0;for(let i=0;i<e.length;i++)n=(n<<5)-n+e.charCodeAt(i),n=n&n;t=n,r=n+114007148193232e5}else t=Date.now(),r=Date.now()+114007148193232e5;return{s0:BigInt(t),s1:BigInt(r)}}random(){let e=this.state.s0,t=this.state.s1,r=e;return t=t^t<<BigInt(23),t=t^t>>BigInt(17),t=t^(r^r>>BigInt(26)),this.state.s0=r,this.state.s1=t,Number(t+r&BigInt(18446744073709552e3))/18446744073709552e3}randomInt(e,t){return Math.floor(this.random()*(t-e))+e}randomIntInclusive(e,t){return Math.floor(this.random()*(t-e+1))+e}};function et(){return w.seed}function ae(e){if(w.seed=e,e){w.prng=new Q(e);try{localStorage.setItem("fates-edge-deck-seed",e)}catch{}}else{w.prng=null;try{localStorage.removeItem("fates-edge-deck-seed")}catch{}}return!0}function De(){try{if(window&&window.crypto&&window.crypto.getRandomValues){const e=new Uint32Array(4);return window.crypto.getRandomValues(e),e.reduce((t,r)=>t+r.toString(16).padStart(8,"0"),"")}}catch{}return Date.now().toString(36)+Math.random().toString(36).substring(2,8)}try{const e=localStorage.getItem("fates-edge-deck-seed");e&&(w.seed=e,w.prng=new Q(e),console.log("[Decks] Seed loaded from localStorage:",e.substring(0,8)+"..."))}catch{}if(!w.seed&&typeof window<"u"&&window.__RANDOM_SEED){w.seed=window.__RANDOM_SEED,w.prng=new Q(w.seed);try{localStorage.setItem("fates-edge-deck-seed",w.seed)}catch{}}if(!w.seed&&typeof window<"u")try{const e=localStorage.getItem("fates-edge-seed");e&&(w.seed=e,w.prng=new Q(w.seed),localStorage.setItem("fates-edge-deck-seed",w.seed),console.log("[Decks] Seed shared from dice module:",w.seed.substring(0,8)+"..."))}catch{}function tt(){if(w.prng)return w.prng.random();try{if(typeof window<"u"&&window.crypto&&window.crypto.getRandomValues){const e=new Uint32Array(1);return window.crypto.getRandomValues(e),e[0]/4294967296}}catch{}return Math.random()}function H(e,t){return w.prng?w.prng.randomInt(e,t):Math.floor(tt()*(t-e))+e}function nt(e){const t=[...e];for(let r=t.length-1;r>0;r--){const n=H(0,r+1);[t[r],t[n]]=[t[n],t[r]]}return t}function k(e){return e?e.isJoker===!0||typeof e.rank=="string"&&e.rank.toLowerCase()==="joker"||typeof e.suit=="string"&&e.suit.toLowerCase()==="joker":!1}function rt(e){const t=parseInt(e,10);return isNaN(t)?String(e):t>=2&&t<=10?String(t):t===11?"J":t===12?"Q":t===13?"K":t===14?"A":String(t)}function oe(e){if(!e||typeof e!="string")return[];const t=[],r=e.match(/#([A-Za-z0-9_]+)/g);r&&t.push(...r.map(o=>o.slice(1).toUpperCase()));const n=e.match(/\b([A-Z]{3,})\b/g);n&&t.push(...n);const i=e.match(/\[([A-Za-z0-9_]+)\]/g);return i&&t.push(...i.map(o=>o.slice(1,-1).toUpperCase())),[...new Set(t)]}var M=null,f=[],R=[],z=null,b=[],p=null,W=0,de=[];W=H(0,1e3);var N=new Map;function it(e){return{name:e,description:`${e} – A region of Fate's Edge. (Using fallback data)`,hearts:{A:"A matter of loyalty or love arises."},spades:{A:"A conflict or struggle emerges."},clubs:{A:"A physical challenge or obstacle appears."},diamonds:{A:"A resource, treasure, or opportunity is found."}}}async function B(e){if(N.has(e))return console.log(`[Decks] Using cached data for ${e}`),N.get(e);const t=_e(e),r=`${F}/${t}.json`;try{const n=await fetch(r);if(!n.ok)throw new Error(`HTTP ${n.status}`);const i=dt(await n.json());return N.set(e,i),console.log(`[Decks] Loaded region data for ${e}`),i}catch(n){console.warn(`[Decks] Could not load ${e}, using fallback.`,n);const i=it(e);return N.set(e,i),y(`⚠️ Could not load region "${e}". Using fallback.`,"warning"),i}}var ot=["em","strong","i","b"];function j(e){return String(e).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function st(e){const t=[],r=new RegExp(`</?(?:${ot.join("|")})>`,"gi");let n=j(String(e).replace(r,i=>(t.push(i),`\0${t.length-1}\0`)));return n=n.replace(/\u0000(\d+)\u0000/g,(i,o)=>t[Number(o)]),n}function at(e){return e.replace(/\[([A-Za-z][A-Za-z ]{0,20}):\s*([^\]]+)\]/g,(t,r,n)=>`
        <span style="display:inline-block;margin:0.15rem 0.25rem 0.15rem 0;padding:0.05rem 0.5rem;background:var(--bg4);border-radius:10px;border-left:2px solid var(--gold);font-size:0.85em;">
            <strong style="color:var(--gold);">${r}:</strong> ${n}
        </span>
    `)}function lt(e){return e.replace(/\*\*([^*]+)\*\*/g,"<strong>$1</strong>")}function O(e){return e?at(lt(st(e))):""}function ct(e){return e?String(e).split(/\n\s*\n/).map(t=>t.trim()).filter(Boolean).map(t=>`<p style="margin:0.4rem 0;line-height:1.5;">${O(t)}</p>`).join(""):""}function _e(e){return e.toLowerCase().replace(/ /g,"_").replace(/[^a-z0-9_]/g,"")}function dt(e){if(!e)return null;if(e.hearts&&e.spades&&e.clubs&&e.diamonds&&typeof e.hearts=="object")return e;const t={name:e.title||e.id||"Unknown",description:"",spades:{},hearts:{},clubs:{},diamonds:{},tags:[],metadata:{source_file:e.id||"unknown"}};if(e.overview){let n="";e.overview.tagline&&(n+=`<p><em>${j(e.overview.tagline)}</em></p>`),e.overview.genre&&(n+=`<p><strong>Genre:</strong> ${j(e.overview.genre)}</p>`),e.overview.mood&&(n+=`<p><strong>Mood:</strong> ${j(e.overview.mood)}</p>`),e.overview.starting_location&&(n+=`<p><strong>Starting Location:</strong> ${j(e.overview.starting_location)}</p>`),e.overview.lore&&(e.overview.lore.history&&(n+=`<p>${j(e.overview.lore.history)}</p>`),e.overview.lore.first_notice&&(n+=`<p><strong>What you notice first:</strong> ${j(e.overview.lore.first_notice)}</p>`),e.overview.lore.rule_that_kills&&(n+=`<p><strong>Rule that kills:</strong> ${j(e.overview.lore.rule_that_kills)}</p>`)),t.description=n,t.tags=oe(JSON.stringify(e.overview))}const r={spades:"places",hearts:"people_and_factions",clubs:"complications",diamonds:"rewards"};for(const n of Ae){const i=e[r[n]];if(!(!i||!Array.isArray(i)))for(const o of i){const a=String(o.rank||"");if(!a)continue;const l=rt(a);let s=`${o.title||"Untitled"}: ${o.description||""}`;o.flavor&&(s+=` <em>${o.flavor}</em>`),o.mechanical_hook&&(s+=` [Mechanic: ${o.mechanical_hook}]`),o.what_they_carry&&(s+=` [Carries: ${o.what_they_carry}]`),o.what_they_ask&&(s+=` [Asks: ${o.what_they_ask}]`),o.debt&&(s+=` [Debt: ${o.debt}]`),o.price&&(s+=` [Price: ${o.price}]`),o.curse_cost&&(s+=` [Cost: ${o.curse_cost}]`),t[n][l]=s;const u=[];o.subtitle&&u.push(o.subtitle),o.tags&&Array.isArray(o.tags)&&u.push(...o.tags);const c=oe(JSON.stringify(o));u.push(...c);for(const d of u){const v=d.replace(/[\[\]]/g,"").trim().toUpperCase();v&&t.tags.push(v)}}}for(const n of["ninth_taboo","lore_echoes","superstitions","additional_features"])if(e[n]){const i=oe(JSON.stringify(e[n]));t.tags.push(...i)}return t.tags=[...new Set(t.tags)].filter(n=>n&&n.length>0),t.metadata={source_file:e.id||"unknown",version:e.version||"1.0.0",type:e.type||"generator"},t}function ue(e,t,r){const n=r[e],i=G[t]||t,o=U[e]||e,a=Ee[e]||{label:"Element",desc:"a force"},l=je[t]||{tier:"Minor",segments:4};if(!n||!n[t]){const d=l.tier,v=l.segments;return`${i} of ${o} (${a.label} – ${d}): A ${a.label.toLowerCase()} arises. ${a.desc}. This card suggests a ${d.toLowerCase()} influence (${v}-segment clock if this is the highest card).`}const s=n[t],u=l.tier,c=l.segments;return`${i} of ${o} (${a.label} – ${u}): ${s} (${c} segments if highest).`}function Re(e,t){const r=Ze,n=(e?.suit||"joker")+(e?.rank||"")+W+999;let i=0;for(let a=0;a<n.length;a++)i=(i<<5)-i+n.charCodeAt(a),i=i&i;const o=Math.abs(i)%r.length;return`✨ Twist (${k(e)?"Joker":`${e?.rankName||e?.rank||"?"} of ${e?.suitName||e?.suit||"?"}`}): ${r[o]}`}function ge(e,t){const r=e?e.toLowerCase():"generic";let n=P[r];if(!n){const l=Object.keys(P).find(s=>s!=="generic"&&r.includes(s));l&&(n=P[l])}n||(n=P.generic);const i=(t?.suit||"")+(t?.rank||"")+"deck";let o=0;for(let l=0;l<i.length;l++)o=(o<<5)-o+i.charCodeAt(l),o=o&o;const a=Math.abs(o)%n.length;return n[a]}function Y(){const e=["hearts","spades","clubs","diamonds"],t=[];f.length<4&&T();for(const r of e){let n=-1;for(let i=0;i<f.length;i++)if(f[i].suit===r&&!k(f[i])){n=i;break}if(n===-1)return T(),Y();t.push(f.splice(n,1)[0])}return t}async function Ie(){try{return(await Te(()=>import("./sync.i5xh8ufD.js").then(e=>e.r),__vite__mapDeps([0,1,2,3,4]))).syncManager}catch{return null}}function Z(e,t,r,n){Ie().then(i=>{if(i&&i.isConnected&&i.send){const o=e.map(a=>({suit:a.suit,rank:a.rank,symbol:a.symbol,rankName:a.rankName,suitName:a.suitName,isJoker:k(a)}));i.send({type:"deck_draw",action:"draw",cards:o,drawType:t,region:r,synthesis:n,timestamp:Date.now()})}}).catch(()=>{})}function ut(){Ie().then(e=>{e&&e.isConnected&&e.send&&e.send({type:"deck_draw",action:"reset",timestamp:Date.now()})}).catch(()=>{})}function gt(e,t,r){if(k(e))return{title:"🃏 Joker — The Wildcard",description:"The unexpected. The impossible. A force that does not follow the rules.",regionMeaning:null};const n=ue(e.suit,e.rank,r),i=G[e.rank]||e.rank,o=U[e.suit],a=le[e.suit],l=ce[e.suit],s=`${{root:"This is what has been growing beneath the surface—the root of the matter.",crest:"This is what is gathering strength—the rising force you cannot ignore.",crown:"This is the shape of the storm that awaits—the confrontation you must face.",left:"This is what anchors you—the bond, ally, or resource that will see you through."}[t.key]}

${n}`;return{title:`${a} ${i} of ${o}`,description:s,regionMeaning:n,suit:e.suit,rank:e.rank,color:l,symbol:a}}function me(e,t,r){const n=Xe,i=e.map((g,A)=>{const m=n[A];return{...gt(g,m,r),position:m,card:g,isJoker:k(g),rankName:k(g)?"Joker":G[g.rank],suitName:k(g)?"":U[g.suit]}}),o=`
        <div style="display:flex;justify-content:center;gap:0.5rem;padding:0.5rem;overflow-x:auto;flex-wrap:nowrap;">
            ${i.map(g=>`
        <div class="crown-card" style="display:flex;flex-direction:column;align-items:center;gap:0.3rem;min-width:80px;">
            <div style="background:var(--bg3);border:2px solid ${g.isJoker?"var(--gold)":g.color};border-radius:var(--radius);padding:0.4rem;text-align:center;width:70px;height:100px;display:flex;flex-direction:column;align-items:center;justify-content:center;${g.isJoker?"box-shadow: 0 0 15px rgba(212,175,55,0.3);":""}">
                <div style="font-size:0.7rem;color:var(--text3);">${g.position.icon}</div>
                <div style="font-size:1.8rem;color:${g.isJoker?"var(--gold)":g.color};">${g.isJoker?"🃏":g.symbol}</div>
                <div style="font-size:0.6rem;color:var(--text2);">${g.isJoker?"Joker":g.rankName}</div>
            </div>
            <div style="font-size:0.6rem;color:var(--text3);text-align:center;max-width:80px;">${g.position.label}</div>
        </div>
    `).join("")}
            <div style="display:flex;align-items:center;color:var(--text3);font-size:1.5rem;padding:0 0.2rem;">+</div>
            
        <div class="crown-card wildcard" style="display:flex;flex-direction:column;align-items:center;gap:0.3rem;min-width:80px;">
            <div style="background:var(--bg3);border:2px solid var(--gold);border-radius:var(--radius);padding:0.4rem;text-align:center;width:70px;height:100px;display:flex;flex-direction:column;align-items:center;justify-content:center;box-shadow: 0 0 20px rgba(212,175,55,0.4);animation:pulse-gold 1.5s ease-in-out infinite;">
                <div style="font-size:0.7rem;color:var(--gold);">🌟</div>
                <div style="font-size:1.8rem;color:var(--gold);">🃏</div>
                <div style="font-size:0.6rem;color:var(--gold);">Wildcard</div>
            </div>
            <div style="font-size:0.6rem;color:var(--gold);text-align:center;max-width:80px;">Wildcard<br>Twist</div>
        </div>
    
        </div>
    `,a=i.map(g=>`
        <div style="display:grid;grid-template-columns:100px 1fr;gap:0.5rem;padding:0.5rem;background:var(--bg2);border-radius:var(--radius);margin-bottom:0.3rem;border-left:4px solid ${g.isJoker?"var(--gold)":g.color};">
            <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;">
                <div style="font-size:1.5rem;color:${g.isJoker?"var(--gold)":g.color};">${g.isJoker?"🃏":g.symbol}</div>
                <div style="font-size:0.8rem;font-weight:600;color:var(--gold);">${g.isJoker?"Joker":g.rankName}</div>
                <div style="font-size:0.65rem;color:var(--text3);">${g.position.icon} ${g.position.label}</div>
            </div>
            <div style="display:flex;flex-direction:column;justify-content:center;">
                <div style="font-size:0.8rem;color:var(--text2);font-weight:600;">${g.position.label}</div>
                <div style="font-size:0.85rem;color:var(--text);line-height:1.4;">${O(g.regionMeaning||g.description)}</div>
            </div>
        </div>
    `).join(""),l=Re(t,r),s=`
        <div style="display:grid;grid-template-columns:100px 1fr;gap:0.5rem;padding:0.5rem;background:var(--bg4);border-radius:var(--radius);margin-top:0.3rem;border:2px solid var(--gold);">
            <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;">
                <div style="font-size:1.5rem;color:var(--gold);">🌟</div>
                <div style="font-size:0.8rem;font-weight:600;color:var(--gold);">Wildcard</div>
            </div>
            <div style="display:flex;flex-direction:column;justify-content:center;">
                <div style="font-size:0.8rem;color:var(--gold);font-weight:600;">Wildcard Twist</div>
                <div style="font-size:0.85rem;color:var(--text);line-height:1.4;">${O(l)}</div>
            </div>
        </div>
    `;let u=`The Crown Spread reveals a story of tension and consequence.

`;u+=`🌱 Root: ${i[0].regionMeaning||i[0].description}

`,u+=`🏔️ Crest: ${i[1].regionMeaning||i[1].description}

`,u+=`👑 Crown: ${i[2].regionMeaning||i[2].description}

`,u+=`🤝 Left Hand: ${i[3].regionMeaning||i[3].description}

`,u+=`🌟 Wildcard: ${l}`;const c=e.filter(g=>!k(g));let d=null;c.length>0?d=c.reduce((g,A)=>{const m=ie[g.rank]||0,E=ie[A.rank]||0;return m!==E?m>E?g:A:(Ce[g.suit]||0)>(Ce[A.suit]||0)?g:A}):d=e[0];let v=null,x="";if(d&&!k(d)){const g=ie[d.rank]||0;let A=4;g===14?A=10:g>=10?A=8:g>=6?A=6:A=4,v=A,x=`${d.rankName} of ${d.suitName}`}else d&&(v=4,x="Joker (Wildcard)");v&&(u+=`

⏱️ The highest card (${x}) suggests a timer of ${v} segments—a pressure that will build until it breaks.`);const $=`
        <div class="crown-horizontal" style="margin-bottom:0.8rem;">
            ${o}
            <div style="text-align:center;font-size:0.7rem;color:var(--text3);margin-top:0.3rem;">
                Click a card below to see its meaning
            </div>
        </div>
        <div class="crown-vertical" style="border-top:1px solid var(--border);padding-top:0.8rem;">
            <div style="font-size:0.8rem;font-weight:600;color:var(--text2);margin-bottom:0.3rem;">📖 Card Meanings</div>
            ${a}
            ${s}
        </div>
    `;return{synthesis:u,details:$,timer:v?{segments:v,card:x}:null,positions:i,wildcard:l,horizontalLayout:o,verticalLayout:a}}async function _(){const e=document.getElementById("deck-region-select");if(!e)return;const t=e.value,r=document.getElementById("region-description");if(!t){r&&(r.textContent="Select a region to display its description.");return}p=t;const n=await B(t);r&&(n&&n.description?r.innerHTML=n.metadata&&n.metadata.type==="generator"?n.description:Ke(n.description):r.innerHTML='<span style="color:var(--text2);">No description available.</span>'),de.forEach(i=>{try{i(t,n)}catch{}})}async function V(e){M=e,M.innerHTML=`
        <div class="decks-header">
            <h1 class="page-title">🃏 Deck of Consequences</h1>
            <p class="page-sub">Loading regions...</p>
        </div>
        <div style="display:flex;justify-content:center;padding:2rem;">
            <span style="color:var(--text2);">📂 Discovering available regions…</span>
        </div>
    `,b=await se(F);let t=b.map(c=>`<option value="${c}">${c}</option>`).join("");b.length===0&&(t='<option value="">No regions available</option>');const r=!!w.seed,n=b.length,{accessible:i}=L("decks");let o="";i?o=`
            <div class="panel">
                <h3>Draw Type</h3>
                <div class="deck-controls" style="display:flex;flex-wrap:wrap;gap:0.8rem;align-items:end;">
                    <div class="field" style="flex:0 0 200px;">
                        <label>Cost / Draw</label>
                        <select id="deck-draw-type">
                            <option value="1">1 SB (1 card)</option>
                            <option value="2" selected>2 SB (2 cards)</option>
                            <option value="3">3 SB (3 cards)</option>
                            <option value="crown">👑 Crown Spread (4+1 wildcard)</option>
                        </select>
                    </div>
                    <button class="btn btn-gold" id="deck-draw-btn">🃏 Draw</button>
                    <button class="btn" id="deck-reshuffle-btn">↺ Reshuffle</button>
                    <span class="text-muted" id="deck-cards-remaining">54 cards</span>
                </div>
                <div id="spread-type-indicator" style="margin-top:0.4rem;font-size:0.85rem;color:var(--text2);">
                    <span id="spread-description">Single draw: one consequence</span>
                </div>
            </div>

            <div class="panel" id="consequence-display">
                <h3 id="consequence-title">Cards Drawn</h3>
                <div id="crown-spread-cards" style="margin:0.8rem 0;display:none;"></div>
                <div class="card-grid" id="drawn-cards" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:0.8rem;margin:0.8rem 0;"></div>
                <div id="consequence-synthesis" class="consequence-synthesis" style="background:var(--bg3);border-left:4px solid var(--gold);padding:0.8rem 1rem;border-radius:var(--radius);margin-top:0.8rem;font-style:italic;white-space:pre-wrap;">
                    Draw cards to see a complication.
                </div>
                <div id="crown-spread-details" style="margin-top:0.8rem;display:none;"></div>
                <div id="timer-result" style="margin-top:0.8rem;display:none;background:var(--bg3);padding:0.5rem 1rem;border-radius:var(--radius);border-left:4px solid var(--accent);"></div>
            </div>
        `:o=`
            <div class="panel" style="background:var(--bg2);border:2px dashed var(--border);text-align:center;padding:1.5rem;">
                <div style="font-size:2rem;">🔒</div>
                <h3 style="color:var(--text2);">Deck is GM‑only</h3>
                <p style="color:var(--text3);">Only the Game Master can draw cards in a connected session.</p>
                <p style="font-size:0.8rem;color:var(--text3);">You can still browse regions and view the history.</p>
            </div>
        `,M.innerHTML=`
        <div class="decks-header">
            <h1 class="page-title">🃏 Deck of Consequences</h1>
            <p class="page-sub">Transform Story Beats (SB) into thematic complications. Choose a region and draw type.</p>
        </div>

        <div class="panel" style="padding:0.3rem 0.8rem;margin-bottom:0.5rem;background:var(--bg3);border-left:3px solid ${r?"var(--gold)":"var(--text3)"};">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.3rem;">
                <span style="font-size:0.8rem;color:var(--text2);">
                    ${r?"🎲 Deterministic RNG (seeded)":"🔀 Cryptographic RNG (random)"}
                    ${r?`<span style="font-size:0.6rem;color:var(--text3);font-family:monospace;">seed: ${w.seed.substring(0,8)}...</span>`:""}
                </span>
                <div style="display:flex;gap:0.3rem;flex-wrap:wrap;">
                    <button class="btn btn-xs btn-ghost" id="deck-seed-regenerate" title="Regenerate seed">🔄 New Seed</button>
                    <button class="btn btn-xs btn-ghost" id="deck-seed-clear" title="Clear seed (use crypto)">🧹 Clear Seed</button>
                </div>
            </div>
        </div>

        <div class="panel">
            <div class="field" style="max-width:300px;display:flex;align-items:center;gap:0.5rem;">
                <label style="margin:0;">Region</label>
                <select id="deck-region-select">
                    <option value="">— Select Region —</option>
                    ${t}
                </select>
                <button class="btn btn-xs btn-ghost" id="deck-refresh-regions" title="Re-scan for region files">🔄</button>
                <span style="font-size:0.7rem;color:var(--text3);white-space:nowrap;">(${n} regions)</span>
            </div>
            ${b.length===0?'<div style="color:var(--warn);font-size:0.8rem;margin-top:0.3rem;">⚠️ No region files found. Using fallback defaults.</div>':""}
            <div id="region-description" style="margin-top:0.8rem;background:var(--bg2);padding:0.8rem 1rem;border-radius:var(--radius);border-left:4px solid var(--gold);color:var(--text);font-size:1rem;line-height:1.6;max-height:60vh;overflow-y:auto;">
                <span style="color:var(--text2);">Select a region to display its description.</span>
            </div>
        </div>

        ${o}

        <div class="panel">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;">
                <h3 style="margin:0;">📜 History</h3>
                ${i?'<button class="btn btn-sm" id="deck-history-clear-btn">Clear History</button>':""}
            </div>
            <div class="deck-history" id="deck-history" style="max-height:200px;overflow-y:auto;margin-top:0.5rem;"></div>
        </div>
    `,T(),K(),fe(),Ne();const a=document.getElementById("deck-region-select");a&&(a.addEventListener("change",_),b.length>0?(a.value=b[0],await _(),p=b[0]):p&&(a.value=p,await _()));const l=document.getElementById("deck-seed-regenerate");l&&l.addEventListener("click",function(){const c=De();ae(c);try{localStorage.setItem("fates-edge-seed",c)}catch{}W=H(0,1e3),V(M),y("🎲 New deck seed generated: "+c.substring(0,8)+"...","success")});const s=document.getElementById("deck-seed-clear");s&&s.addEventListener("click",function(){confirm("Clear the deterministic seed? This will use cryptographic RNG instead.")&&(ae(null),W=H(0,1e3),V(M),y("🧹 Deck seed cleared. Using cryptographic RNG.","info"))});const u=document.getElementById("deck-refresh-regions");u&&u.addEventListener("click",async function(){localStorage.removeItem("fates-edge-region-cache"),N.clear(),b=await se(F);const c=document.getElementById("deck-region-select");if(c){const d=c.value;c.innerHTML='<option value="">— Select Region —</option>',b.forEach(x=>{const $=document.createElement("option");$.value=x,$.textContent=x,c.appendChild($)}),d&&b.includes(d)?c.value=d:b.length>0&&(c.value=b[0]),await _();const v=document.querySelector("#deck-region-select + span");v&&(v.textContent=`(${b.length} regions)`),y("🗺️ Region list refreshed.","success")}})}function T(){f=[];for(const e of Ae)for(const t of Ye)f.push({suit:e,rank:t,symbol:le[e],color:ce[e],suitName:U[e],rankName:G[t]||t,isJoker:!1});f.push({suit:"joker",rank:"Red",symbol:"🃏",color:"#d4af37",isJoker:!0,suitName:"Joker",rankName:"Red"}),f.push({suit:"joker",rank:"Black",symbol:"🃏",color:"#d4af37",isJoker:!0,suitName:"Joker",rankName:"Black"}),f=nt(f),J(),console.log("🔀 Deck shuffled, total cards:",f.length,w.seed?"(deterministic)":"(random)"),typeof h=="function"&&h("deck_shuffle",`Deck shuffled. ${f.length} cards remaining.`)}function J(){const e=document.getElementById("deck-cards-remaining");e&&(e.textContent=f.length+" cards")}function Ne(){const e=document.getElementById("deck-draw-type")?.value,t=document.getElementById("spread-description");t&&(e==="crown"?t.textContent="👑 Crown Spread: 4 cards (Root, Crest, Crown, Left Hand) + 1 wildcard twist. Each card draws from the selected region's deck.":e==="2"?t.textContent="Two draws: a complication with an additional twist.":e==="3"?t.textContent="Three draws: a chain of consequences.":t.textContent="Single draw: one focused consequence.")}async function X(){const{accessible:e}=L("decks");if(!e){y("Only the GM can draw cards.","error");return}if(!p){y("Please select a region first.","error");return}const t=await B(p);if(!t)return;const r=document.getElementById("deck-draw-type")?.value||"1";let n=[],i=!1;if(r==="crown"){i=!0,f.length<5&&(y("Deck running low! Reshuffling...","warning"),T());const m=Y();f.length===0&&T();const E=f.pop();n=[...m,E]}else{const m=parseInt(r,10)||1;f.length<m&&(y("Deck running low! Reshuffling...","warning"),T());for(let E=0;E<m;E++)f.length===0&&T(),n.push(f.pop())}J(),mt(n,i);let o,a=null,l=null,s=null,u=null;const c=n.filter(m=>m.rank==="A"&&!k(m));if(c.length>0){const m=c[0];u=ge(p,m)}if(i){const m=n.slice(0,4),E=n[4],I=me(m,E,t);o=I.synthesis,a=I.details,l=I.timer,s=I.horizontalLayout;const ne=document.getElementById("crown-spread-cards");if(ne&&(ne.style.display="block",ne.innerHTML=`
                <div style="background:var(--bg2);border-radius:var(--radius);padding:0.5rem;">
                    ${s}
                </div>
            `),typeof h=="function"){const Ue=m.map(ke=>`${ke.rankName} of ${ke.suitName}`).join(", ");h("crown_spread",`Crown Spread: ${Ue} | Wildcard: ${k(E)?"Joker":`${E.rankName} of ${E.suitName}`} | Region: ${p}`)}}else{const m=document.getElementById("crown-spread-cards");if(m&&(m.style.display="none"),o=Me(n,t),typeof h=="function"){const E=n.map(I=>`${I.rankName} of ${I.suitName}`).join(", ");h("deck_draw",`${n.length} card(s) drawn: ${E} | Region: ${p}`)}}let d="";u&&(d=`

♠️ **Ace Effect:** ${u.emoji} ${u.text}`,o+=d,y(`♠️ Ace Effect: ${u.text}`,"warning"),typeof h=="function"&&h("deck_ace",`♠️ Ace Effect: ${u.emoji} ${u.text} (${p})`));const v=document.getElementById("consequence-synthesis");v&&(v.innerHTML=`<strong>Consequence:</strong>${ct(o)}`);const x=document.getElementById("crown-spread-details");if(a){x.style.display="block",x.innerHTML=a;const m=document.getElementById("consequence-title");m&&(m.textContent="👑 Crown Spread")}else{x&&(x.style.display="none");const m=document.getElementById("consequence-title");m&&(m.textContent=r==="crown"?"👑 Crown Spread":`🃏 ${r} Draw${r>1?"s":""}`)}const $=document.getElementById("timer-result");if(l){$.style.display="block",$.innerHTML=`
            <strong>⏱️ Suggested Timer:</strong> ${l.segments} segments (from highest card: ${l.card})
            <button class="btn btn-sm btn-primary" id="create-timer-btn" style="margin-left:0.5rem;">➕ Add Timer</button>
        `;const m=$.querySelector("#create-timer-btn");m&&m.addEventListener("click",()=>{ze(l.card,l.segments)})}else $.style.display="none";const g=n.map(m=>k(m)?`🃏${m.rank}`:`${m.rankName} of ${m.suitName}`).join(" | ");R.push({time:new Date().toLocaleTimeString(),cards:g,synthesis:o.replace(/\n/g," "),type:r==="crown"?"Crown Spread":`${r} Draw${r>1?"s":""}`,aceEffect:u?`${u.emoji} ${u.text}`:null}),K(),Z(n,r,p,o);const A=n.map(m=>k(m)?"🃏 Joker":`${m.rankName} of ${m.suitName}`).join(", ");y(`🃏 Drew ${n.length} card${n.length>1?"s":""}: ${A}`,"success")}function Me(e,t){const r=e.map(n=>k(n)?Re(n,t):ue(n.suit,n.rank,t));return r.length===1?r[0]:r.length===2?`${r[0]}

Then, ${r[1]}`:r.map((n,i)=>`${i+1}. ${n}`).join(`

`)}function mt(e,t){const r=document.getElementById("drawn-cards");if(r){if(t){r.innerHTML="";return}r.innerHTML=e.map((n,i)=>{const o=k(n);let a="card-slot";o?a+=" joker":a+=" "+n.suit;let l=o?"Joker":n.rank||"?",s=o?"🃏":n.symbol||le[n.suit]||"♦",u=o?"var(--gold)":n.color||ce[n.suit]||"#2980b9",c=o?"Joker":n.suitName||U[n.suit]||"";return`
            <div class="${a}" style="background:var(--bg3);border:2px solid var(--border);border-radius:var(--radius);padding:0.4rem;text-align:center;font-weight:700;min-height:100px;display:flex;flex-direction:column;align-items:center;justify-content:center;transition:border-color 0.2s, transform 0.2s;${o?"border-color: var(--gold); box-shadow: 0 0 10px rgba(212,175,55,0.3);":`border-left:6px solid ${u};`}">
                <div class="rank" style="font-size:1rem;color:var(--text2);">${o?"":l}</div>
                <div class="suit" style="font-size:2.5rem;line-height:1.2;color:${o?"var(--gold)":u}">${s}</div>
                <div class="label" style="font-size:0.65rem;color:var(--text3);">${o?"Joker":c}</div>
            </div>
        `}).join("")}}function ze(e,t){Te(()=>import("./timers.DECKYaq0.js").then(r=>{if(r.openTimerEditor)r.openTimerEditor({name:`Crown Spread: ${e}`,segments:t,current:0}),y(`⏱️ Creating timer from ${e} (${t} segments)`,"success"),typeof h=="function"&&h("timer_created",`Timer created from Crown Spread: ${e} (${t} segments)`);else{const n=xe();n.timers||(n.timers=[]);const i={id:"timer-"+Date.now()+"-"+Math.random().toString(36).substr(2,4),name:`Crown Spread: ${e}`,segments:t,current:0};n.timers.push(i),document.dispatchEvent(new CustomEvent("timer-added",{detail:{timer:i}})),y(`⏱️ Timer created: ${i.name} (${t} segments)`,"success"),typeof h=="function"&&h("timer_created",`Timer created: ${i.name} (${t} segments)`)}}),__vite__mapDeps([5,3,2,1,4,6,7,8,0,9])).catch(()=>{const r=xe();r.timers||(r.timers=[]);const n={id:"timer-"+Date.now()+"-"+Math.random().toString(36).substr(2,4),name:`Crown Spread: ${e}`,segments:t,current:0};r.timers.push(n),document.dispatchEvent(new CustomEvent("timer-added",{detail:{timer:n}})),y(`⏱️ Timer created: ${n.name} (${t} segments)`,"success"),typeof h=="function"&&h("timer_created",`Timer created: ${n.name} (${t} segments)`)})}function K(){const e=document.getElementById("deck-history");if(e){if(R.length===0){e.innerHTML='<span class="text-muted">No draws yet.</span>';return}e.innerHTML=R.slice().reverse().map(t=>`<div style="padding:0.3rem 0;border-bottom:1px solid var(--border);font-size:0.8rem;display:flex;flex-wrap:wrap;gap:0.3rem;align-items:center;">
            <span style="color:var(--text3);font-size:0.7rem;">[${t.time}]</span>
            <span style="background:var(--bg3);padding:0.05rem 0.4rem;border-radius:8px;font-size:0.7rem;">${t.type}</span>
            <span style="font-weight:500;">${t.cards}</span>
            <span style="color:var(--text2);font-size:0.75rem;">→</span>
            <span style="font-size:0.8rem;">${t.synthesis}</span>
            ${t.aceEffect?`<span style="color:var(--gold);font-size:0.7rem;">${t.aceEffect}</span>`:""}
        </div>`).join("")}}function ft(){R=[],K(),y("Deck history cleared.","success"),typeof h=="function"&&h("deck_history_cleared","Deck history cleared")}function Le(){return R.slice()}function ee(){const{accessible:e}=L("decks");if(!e){y("Only the GM can reset the deck.","error");return}W=H(0,1e3),T();const t=document.getElementById("drawn-cards");t&&(t.innerHTML="");const r=document.getElementById("crown-spread-cards");r&&(r.innerHTML="",r.style.display="none");const n=document.getElementById("consequence-synthesis");n&&(n.innerHTML="Deck reshuffled. Draw to begin.");const i=document.getElementById("crown-spread-details");i&&(i.style.display="none");const o=document.getElementById("timer-result");o&&(o.style.display="none");const a=document.getElementById("consequence-title");a&&(a.textContent="Cards Drawn"),ut(),typeof h=="function"&&h("deck_reset","Deck reset and reshuffled"),y(`Deck reshuffled with new random seeds.${w.seed?" (deterministic)":""}`,"success")}async function Be(){console.log("[Decks] Activated");const e=document.getElementById("deck-region-select");e&&e.value&&await _()}function Je(){console.log("[Decks] Deactivated")}async function qe(){localStorage.removeItem("fates-edge-region-cache"),N.clear(),b=await se(F);const e=document.getElementById("deck-region-select");if(e){const t=e.value;e.innerHTML='<option value="">— Select Region —</option>',b.forEach(n=>{const i=document.createElement("option");i.value=n,i.textContent=n,e.appendChild(i)}),t&&b.includes(t)?e.value=t:b.length>0&&(e.value=b[0]),await _();const r=document.querySelector("#deck-region-select + span");r&&(r.textContent=`(${b.length} regions)`)}}function He(){M=null,f=[],R=[],z=null,p=null,de=[],N.clear()}function fe(){const e=document.getElementById("deck-draw-btn");if(e){const i=e.cloneNode(!0);e.parentNode.replaceChild(i,e),i.addEventListener("click",X)}const t=document.getElementById("deck-reshuffle-btn");if(t){const i=t.cloneNode(!0);t.parentNode.replaceChild(i,t),i.addEventListener("click",ee)}const r=document.getElementById("deck-history-clear-btn");if(r){const i=r.cloneNode(!0);r.parentNode.replaceChild(i,r),i.addEventListener("click",ft)}const n=document.getElementById("deck-draw-type");if(n){const i=n.cloneNode(!0);n.parentNode.replaceChild(i,n),i.addEventListener("change",Ne)}}var C=null,D=null;function pe(){const{accessible:e}=L("decks");if(!e){y("Only the GM can open a Crown Spread.","error");return}C&&C.parentNode&&(C.remove(),C=null,D&&(D.forEach(o=>{o.style.display=""}),D=null)),C=document.createElement("div"),C.className="crown-spread-modal editor-screen-host",C.style.cssText=`
        display: flex; align-items: center; justify-content: center;
        padding: 1rem 0; animation: fadeIn 0.3s ease;
    `,f.length<5&&T();const t=Y();f.length===0&&T();const r=f.pop(),n=[...t,r];J();const i=p||"Acasia";B(i).then(o=>{const a=me(t,r,o);if(typeof h=="function"){const s=t.map(u=>`${u.rankName} of ${u.suitName}`).join(", ");h("crown_spread_modal",`Crown Spread (modal): ${s} | Wildcard: ${k(r)?"Joker":`${r.rankName} of ${r.suitName}`} | Region: ${i}`)}C.innerHTML=`
            <div style="background:var(--bg2);padding:2rem;border-radius:16px;max-width:800px;width:100%;max-height:90vh;overflow-y:auto;border:1px solid var(--border);">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;">
                    <h2 style="color:var(--gold);margin:0;">👑 Crown Spread</h2>
                    <button onclick="window.closeCrownSpread()"
                            style="background:var(--bg3);border:1px solid var(--border);color:var(--text2);font-size:1.5rem;cursor:pointer;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;transition:all 0.2s ease;">
                        ✕
                    </button>
                </div>

                <div style="display:flex;gap:0.5rem;justify-content:center;flex-wrap:wrap;margin-bottom:1rem;">
                    ${a.positions.map(s=>`
                        <div style="background:var(--bg3);border:2px solid ${s.isJoker?"var(--gold)":s.color};border-radius:var(--radius);padding:0.5rem;text-align:center;min-width:70px;${s.isJoker?"box-shadow: 0 0 20px rgba(212,175,55,0.3);":""}">
                            <div style="font-size:0.6rem;color:var(--text3);">${s.position.icon}</div>
                            <div style="font-size:2rem;color:${s.isJoker?"var(--gold)":s.color};">${s.isJoker?"🃏":s.symbol}</div>
                            <div style="font-size:0.6rem;color:var(--text2);">${s.rankName}</div>
                            <div style="font-size:0.5rem;color:var(--text3);">${s.position.label}</div>
                        </div>
                    `).join("")}
                    <div style="background:var(--bg4);border:2px solid var(--gold);border-radius:var(--radius);padding:0.5rem;text-align:center;min-width:70px;box-shadow:0 0 20px rgba(212,175,55,0.3);">
                        <div style="font-size:0.6rem;color:var(--gold);">🌟</div>
                        <div style="font-size:2rem;color:var(--gold);">🃏</div>
                        <div style="font-size:0.6rem;color:var(--gold);">Wild</div>
                        <div style="font-size:0.5rem;color:var(--text3);">Twist</div>
                    </div>
                </div>

                <div style="background:var(--bg3);border-radius:var(--radius);padding:1rem;border-left:4px solid var(--gold);">
                    ${a.positions.map((s,u)=>`
                        <div style="margin-bottom:0.5rem;padding-bottom:0.5rem;${u<3?"border-bottom:1px solid var(--border);":""}">
                            <div style="display:flex;align-items:center;gap:0.5rem;">
                                <span style="color:${s.isJoker?"var(--gold)":s.color};">${s.position.icon}</span>
                                <strong style="color:${s.isJoker?"var(--gold)":s.color};">${s.position.label}</strong>
                                <span style="color:var(--text3);font-size:0.8rem;">${s.rankName} of ${s.suitName}</span>
                            </div>
                            <div style="color:var(--text);font-size:0.95rem;line-height:1.55;margin-left:1.5rem;">${O(s.regionMeaning||s.description)}</div>
                        </div>
                    `).join("")}
                    <div>
                        <div style="display:flex;align-items:center;gap:0.5rem;">
                            <span style="color:var(--gold);">🌟</span>
                            <strong style="color:var(--gold);">Wildcard Twist</strong>
                        </div>
                        <div style="color:var(--text);font-size:0.95rem;line-height:1.55;margin-left:1.5rem;">${O(a.wildcard)}</div>
                    </div>
                </div>

                ${a.timer?`
                    <div style="margin-top:1rem;background:var(--bg3);border-radius:var(--radius);padding:0.5rem 1rem;border-left:4px solid var(--accent);">
                        <strong>⏱️ Suggested Timer:</strong> ${a.timer.segments} segments (from ${a.timer.card})
                        <button class="btn btn-sm btn-primary" onclick="window.createTimerFromCard('${a.timer.card}', ${a.timer.segments})" style="margin-left:0.5rem;">➕ Add Timer</button>
                    </div>
                `:""}

                <div style="margin-top:1rem;display:flex;gap:0.5rem;flex-wrap:wrap;">
                    <button class="btn btn-gold" onclick="window.closeCrownSpread(); setTimeout(window.openCrownSpread, 100);">🔄 New Spread</button>
                    <button class="btn btn-secondary" onclick="window.closeCrownSpread();">Close</button>
                </div>
            </div>
        `;const l=document.getElementById("app-content")||document.body;D=Array.from(l.children),D.forEach(s=>{s.style.display="none"}),l.appendChild(C),window.scrollTo({top:0}),Z(n,"crown",i,a.synthesis),document.addEventListener("keydown",function s(u){u.key==="Escape"&&C&&C.parentNode&&(window.closeCrownSpread(),document.removeEventListener("keydown",s))})})}window.closeCrownSpread=function(){C&&C.parentNode&&(C.remove(),C=null),D&&(D.forEach(e=>{e.style.display=""}),D=null),J()};function he(){return p}function ye(){return[...b]}async function q(e){if(!b.includes(e))return console.warn(`[Decks] Region "${e}" not found`),!1;p=e;const t=document.getElementById("deck-region-select");return t&&(t.value=e,await _()),!0}function We(){return z}function Oe(e,t){if(!z){const r=Ee[e]||{label:"Element",desc:"a force"},n=G[t]||t,i=je[t]||{tier:"Minor",segments:4};return`${n} of ${e} (${r.label}): A ${r.label.toLowerCase()} arises. ${r.desc}. ${i.tier} influence.`}return ue(e,t,z)}function te(e){typeof e=="function"&&(de.push(e),p&&e(p,z))}async function ve(e,t){if(typeof e=="function"){te(e);return}if(typeof e=="string"){const r=e,n=await q(r);return n&&t&&t(r,z),n}await _()}async function we(e=1,t=null){const{accessible:r}=L("decks");if(!r)return y("Only the GM can draw cards.","error"),null;if(t&&await q(t),!p)return y("Please select a region first.","error"),null;const n=await B(p);if(!n)return null;f.length<e&&(y("Deck running low! Reshuffling...","warning"),T());const i=[];for(let c=0;c<e;c++)f.length===0&&T(),i.push(f.pop());J();const o=Me(i,n),a=i.map(c=>k(c)?"🃏 Joker":`${c.rankName} of ${c.suitName}`).join(", ");let l=null,s=o;const u=i.filter(c=>c.rank==="A"&&!k(c));if(u.length>0){const c=u[0];l=ge(p,c),s+=`

♠️ **Ace Effect:** ${l.emoji} ${l.text}`,y(`♠️ Ace Effect: ${l.text}`,"warning"),typeof h=="function"&&h("quick_draw_ace",`♠️ Ace Effect: ${l.emoji} ${l.text} (${p})`)}return Z(i,String(e),p,s),R.push({time:new Date().toLocaleTimeString(),cards:a,synthesis:s.replace(/\n/g," "),type:`${e} Draw${e>1?"s":""}`,aceEffect:l?`${l.emoji} ${l.text}`:null}),K(),typeof h=="function"&&h("quick_draw",`${e} card(s) drawn: ${a} | Region: ${p}`),y(`🎴 ${a}`,"success"),{cards:i,synthesis:s,cardNames:a,type:e,aceEffect:l}}async function be(e=null){const{accessible:t}=L("decks");if(!t)return y("Only the GM can draw a Crown Spread.","error"),null;if(e&&await q(e),!p)return y("Please select a region first.","error"),null;const r=await B(p);if(!r)return null;f.length<5&&(y("Deck running low! Reshuffling...","warning"),T());const n=Y();f.length===0&&T();const i=f.pop(),o=[...n,i];J();const a=me(n,i,r);let l=null,s=a.synthesis;const u=n.filter(d=>d.rank==="A"&&!k(d));if(u.length>0){const d=u[0];l=ge(p,d),s+=`

♠️ **Ace Effect:** ${l.emoji} ${l.text}`,y(`♠️ Ace Effect: ${l.text}`,"warning"),typeof h=="function"&&h("crown_spread_ace",`♠️ Ace Effect: ${l.emoji} ${l.text} (${p})`)}Z(o,"crown",p,s);const c=o.map(d=>k(d)?"🃏 Joker":`${d.rankName} of ${d.suitName}`).join(", ");return R.push({time:new Date().toLocaleTimeString(),cards:c,synthesis:s.replace(/\n/g," "),type:"Crown Spread",aceEffect:l?`${l.emoji} ${l.text}`:null}),K(),typeof h=="function"&&h("crown_spread_quick",`Crown Spread: ${c} | Region: ${p}`),y(`👑 Crown Spread: ${c}`,"success"),{cards:o,mainCards:n,wildcard:i,result:{...a,synthesis:s},cardNames:c,aceEffect:l}}window.openCrownSpread=pe;window.closeCrownSpread=window.closeCrownSpread;window.createTimerFromCard=ze;window.drawConsequence=X;window.resetDeck=ee;window.quickDraw=we;window.quickCrownSpread=be;window.getSelectedRegion=he;window.getRegionNames=ye;window.setSelectedRegion=q;window.registerRegionChange=te;window.onRegionChange=ve;var pt={render:V,drawConsequence:X,resetDeck:ee,attachEvents:fe,onActivate:Be,onDeactivate:Je,refresh:qe,destroy:He,fetchRegionData:B,buildDeck:T,openCrownSpread:pe,closeCrownSpread:window.closeCrownSpread,getSelectedRegion:he,getRegionNames:ye,setSelectedRegion:q,getRegionData:We,getCardMeaning:Oe,registerRegionChange:te,onRegionChange:ve,quickDraw:we,quickCrownSpread:be,getDeckHistory:Le};export{he as a,we as c,ye as i,q as l,$t as n,ve as o,We as r,be as s,pt as t};
