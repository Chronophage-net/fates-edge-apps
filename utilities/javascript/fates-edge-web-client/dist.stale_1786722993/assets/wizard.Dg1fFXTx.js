const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/characters.D4g1AIH0.js","assets/utils.lBShoim5.js","assets/state.42sFgcOQ.js","assets/rolldown-runtime.BQ-_32WO.js","assets/Toast.DDAtBIAw.js","assets/preload-helper.BATLnrmA.js"])))=>i.map(i=>d[i]);
import{a as we,i as d,l as g,n as S}from"./utils.lBShoim5.js";import{b as ee,n as xe}from"./state.42sFgcOQ.js";import{n as f}from"./Toast.DDAtBIAw.js";import{t as ze}from"./preload-helper.BATLnrmA.js";import{t as ke}from"./patrons.Ci1TYIUN.js";var B=["Melee","Ranged","Unarmed","Athletics","Stealth","Endurance","Craft","Sway","Deception","Subterfuge","Performance","Insight","Lore","Investigation","Medicine","Arcana"],te={melee:"body",ranged:"wits",unarmed:"body",athletics:"body",stealth:"wits",endurance:"body",craft:"wits",sway:"presence",deception:"presence",subterfuge:"wits",performance:"presence",insight:"spirit",lore:"wits",investigation:"wits",medicine:"wits",arcana:"spirit"},C=[{id:"human",label:"Human — The Adaptable",adj:"None",note:"Endless Reach: +1 die on untrained skill rolls. Free Endless Reach talent."},{id:"aelaerem",label:"Aelaerem (Halfling) — Hearth & Hollow",adj:"Wits+1, Presence+1, Body−1",note:"Small Folk: Lucky break (improve Position 1/scene). Cannot use Heavy Armor."},{id:"aelinnel",label:"Aelinnel (Gnome) — Stone, Bough, Bright Things",adj:"Wits+1, Spirit+1, Body−1",note:"Small Folk: Short Step (teleport) or Knack (handy item). Cannot use Heavy Armor."},{id:"aeler",label:"Aeler (Dwarf) — Crowns & Under-Vaults",adj:"Body+1, Spirit+1, Presence−1",note:"Stone-sense, breath-counting, oath-cords. Heavy armor proficiency."},{id:"lethai-al",label:"Lethai-al (Wood Elf) — Root, River, Roof-Tree",adj:"Body+1, Wits+1, Presence−1",note:"Root-law, tree-speak, green ward in forests."},{id:"lethai-thora",label:"Lethai-thora (High Elf) — Mind's Eye & Civic Measure",adj:"Wits+1, Spirit+1, Body−1",note:"Lorekeeper, weave anchor, academic immunity."},{id:"lethai-ar",label:"Lethai-ar (Dark Elf) — The Oathbound",adj:"Wits+1, Presence+1, Spirit−1",note:"Mask-right, vow-touch, serpent's shed."},{id:"ykrul",label:"Ykrul (Orc) — Wolf Standards, Winter Camps",adj:"Body+1, Spirit+1, Presence−1",note:"Blood memory, hostage strings, kon'reh intuition. Mounted archery discount."},{id:"narethi",label:"Narethi — The Unburied of the Deep Desert",adj:"Wits+1, Spirit+1, Body−1",note:"Natural telepathy, sunken eyes (darkvision), resonance sense. Resonance Leash [4]."},{id:"mixed",label:"Mixed Heritage — Half-Elves, Half-Ykrul, Half-Others",adj:"Choose one +1 and one −1",note:"Pick two skill bonuses from parent cultures. Access both talent lists."}],R=[{id:"none",label:"No Armor",xpCost:0,conversion:"Harm passes directly"},{id:"light",label:"Light Armor (4 XP)",xpCost:4,conversion:"1→1 Fatigue (min 1/hit)"},{id:"medium",label:"Medium Armor (8 XP)",xpCost:8,conversion:"2→1 Fatigue (min 1/hit)",penalty:"−1d physical skills"},{id:"heavy",label:"Heavy Armor (12 XP)",xpCost:12,conversion:"3→2 Fatigue (min 1/hit)",penalty:"−2d physical, no sprint in rough"}],ae=[{id:"none",label:"No Shield",xpCost:0},{id:"buckler",label:"Buckler (4 XP)",xpCost:4},{id:"heater",label:"Heater (8 XP)",xpCost:8},{id:"pavise",label:"Pavise (12 XP)",xpCost:12}],A=[{id:"light",label:"Light Weapon (4 XP)",xpCost:4,close:"+2d",near:"+1d",note:"Fast, concealable. Free if basic."},{id:"medium",label:"Medium Weapon (8 XP)",xpCost:8,close:"+1d",near:"+2d",note:"Balanced, battlefield standard."},{id:"heavy",label:"Heavy Weapon (12 XP)",xpCost:12,close:"−1d",near:"+3d",note:"Punishing, slow. Set once/scene."}],$e=["","Acasia","Aelaerem","Aeler","Aelinnel","Black Banners","Ecktoria","Linn","Mistlands","Silkstrand","Theona","Thepyrgos","Ubral","Valewood","Vhasia","Viterra","Ykrul","Zakov","Vilikari","Kahfagia","Fhara","Pereshi","Kuvani","Tulkani","Ashaan","Sekogo","Taharka","Sidhi","Ngomebe","Dhahara","Oshiira"],q=[{min:0,max:40,tier:"I",name:"Novice"},{min:41,max:90,tier:"II",name:"Seasoned"},{min:91,max:150,tier:"III",name:"Veteran"},{min:151,max:220,tier:"IV",name:"Paragon"},{min:221,max:1/0,tier:"V",name:"Mythic"}],ne=[{id:"minor",label:"Minor",xpRange:"2–3 XP",min:2,max:3},{id:"major",label:"Major",xpRange:"4–6 XP",min:4,max:6},{id:"prestige",label:"Prestige",xpRange:"7–10 XP",min:7,max:10},{id:"epic",label:"Epic",xpRange:"11+ XP",min:11,max:999}],Se=["One set of clothing appropriate to your culture","A Light melee weapon or ranged weapon with ammunition","Light armor (if your concept demands it)","A backpack, waterskin, 1d6 days of rations","Utility knife, flint and steel, small lantern or candle","Any tools required for your skills (lockpicks, healer's kit, writing materials)"],k=[{id:"none",label:"No Magic Path",cost:0,note:"Attributes and Skills are enough to be effective."},{id:"hedge-gifts",label:"Hedge Gifts (Craft of the Hedge, 4 XP)",cost:4,note:"2 no-roll magical abilities. No resource tracking. Retrain later."},{id:"familiar-only",label:"Familiar Only (Familiar, 2 XP)",cost:2,note:"Companion + Patron's Gift. Obligation per use. Buy Codex later for full Runekeeper."},{id:"runekeeper",label:"Runekeeper (Familiar 2 XP + Codex 4 XP)",cost:6,note:"Structured rites from a Patron. Obligation cost per rite. Reliable but accrues debt."},{id:"free-caster",label:"Free Caster (Spellcraft, 6 XP)",cost:6,note:"Improvised magic via TAGS. Flexible but risky. Backlash on failure."},{id:"invoker",label:"Invoker (Patron's Symbol, 4 XP/Patron)",cost:4,note:"Ritual magic via symbols. Slow but flexible. Crack the Seal for emergencies."},{id:"cantor",label:"Cantor (Cantor's Path, 8 XP)",cost:8,note:"Songs that mimic Low Rites. Accessible but corrupting. Requires Lore 1+, Performance 2+, Presence 2+."},{id:"summoner",label:"Summoner (Pact-Whisperer 2 XP + Lesser Pactwright 2 XP)",cost:4,note:"Bind and command spirits. Powerful but requires Leash management."},{id:"witch",label:"Witchcraft (Craft of the Hedge, 4 XP)",cost:4,note:"Threshold magic. Hedge Gifts + Quick Workings + Full Rituals. Identity Strain track."},{id:"psion",label:"Psion (Psionic Training, 6 XP)",cost:6,note:"Mind-born power fueled by Mental Strain. No patron or tags – pure will."},{id:"monk",label:"Monk (Monastic Training, 4 XP)",cost:4,note:"Breath States, Meditation, and monastic Techniques. Patron-optional."}];function oe(){const e={};return B.forEach(t=>e[t.toLowerCase()]=0),e}function H(e){for(const t of q)if(e>=t.min&&e<=t.max)return t;return q[q.length-1]}var K={"white-hound":"mykkiel",ferret:"inquisitor-prime","bronze-hawk":"inquisitor-prime","mechanical-bird":"inquisitor-prime","garden-spider":"inaea","silk-moth":"inaea","gray-mouse":"inaea","fire-salamander":"oath-of-flame-light","phoenix-fledgling":"oath-of-flame-light","brass-beetle":"sacred-geometry","konreh-pieces":"sacred-geometry","bell-frog":"gallows-bell","gray-mouse-courthouse":"gallows-bell","lead-seal":"varnek-karn",knucklebone:"varnek-karn","confessor-mouse":"confessor-beneath-the-bell","bell-cricket":"confessor-beneath-the-bell","letter-mouse":"silent-choir","forgetfulness-moth":"silent-choir",raven:"the-witness",silverfish:"the-witness","bronze-key":"sealed-gate","bell-ward":"sealed-gate"},Q={"iron-bound-ledger":"inquisitor-prime","slate-tablet":"inquisitor-prime","frame-loom":"inaea","knotted-cords":"inaea","brass-scroll":"oath-of-flame-light","sun-stone":"oath-of-flame-light","brass-stencils":"sacred-geometry","slate-proofs":"sacred-geometry","court-ledger":"gallows-bell","bronze-bells":"gallows-bell","slate-carvings":"varnek-karn","burial-tablets":"varnek-karn","bell-ringers-log":"confessor-beneath-the-bell","leather-strap":"confessor-beneath-the-bell","locked-journal":"silent-choir","wax-tablets":"silent-choir","loose-leaf-pages":"the-witness",chalkboard:"the-witness","leather-strap-seals":"sealed-gate","iron-rings":"sealed-gate"};function Pe({thiasos:e,codex:t}){return e&&K[e]?K[e]:t&&Q[t]?Q[t]:null}var w=null;function N(){if(w)return w;const e=ee().patrons?.cosmic||[];if(e.length===0)return w=[{id:"",label:"None — No Patron"}],w;const t=e.map(a=>({id:a.id,label:`${a.name||a.title||a.id} — ${a.subtitle||a.domain||"Cosmic Patron"}`}));return t.sort((a,n)=>a.label.localeCompare(n.label)),t.unshift({id:"",label:"None — No Patron"}),w=t,w}function Z(e){return N().map(t=>`<option value="${t.id}" ${e===t.id?"selected":""}>${d(t.label)}</option>`).join("")}function P(e,t){let a=0;for(let n=e+1;n<=t;n++)a+=n*3;return a}function _(e,t){let a=0;for(let n=e+1;n<=t;n++)a+=n*2;return a}function v(e){let t=0;t+=P(1,e.body||1),t+=P(1,e.wits||1),t+=P(1,e.spirit||1),t+=P(1,e.presence||1),e.skills&&B.forEach(r=>{t+=_(0,e.skills[r.toLowerCase()]||0)}),e.talents&&e.talents.forEach(r=>t+=g(r.cost,0)),e.assets&&e.assets.forEach(r=>t+=g(r.cost,0)),e.equipment&&e.equipment.forEach(r=>t+=g(r.cost,0));const a=k.find(r=>r.id===(e.magicPath||"none"));a&&(t+=a.cost);const n=R.find(r=>r.id===(e.armorType||"none"));n&&(t+=n.xpCost);const o=ae.find(r=>r.id===(e.shieldType||"none"));o&&(t+=o.xpCost);const i=A.find(r=>r.id===(e.weaponClass||"light"));return i&&e.weaponClass!=="light"&&(t+=i.xpCost),t}function re(e){const t=Math.min((e.bonds||[]).filter(n=>n.start).length,2),a=Math.min((e.complications||[]).filter(n=>n.start).length,2);return Math.min(32+t*2+a*2,36)}var s={step:0,data:null,isOpen:!1,modal:null,_listeners:[]};function Ce(){if(document.getElementById("wizard-modal-styles"))return;const e=document.createElement("style");e.id="wizard-modal-styles",e.textContent=`
        /* Inline editor screen — NOT a pop-up modal. Takes over the page in
           place of whatever was shown before (see openWizard/closeWizard). */
        #wizardModal {
            display: none;
        }
        #wizardModal.open { display: block; }
        @keyframes wizardFadeIn { from { opacity: 0; } to { opacity: 1; } }
        .wizard-content {
            background: var(--bg, #1e1e2e);
            color: var(--text, #e0e0e0);
            border-radius: 12px;
            max-width: 780px;
            width: 100%;
            margin: 0 auto;
            padding: 1.5rem;
            box-shadow: 0 20px 60px rgba(0,0,0,0.35);
            border: 1px solid var(--border, #333);
            animation: wizardFadeIn 0.25s ease;
        }
        .wizard-progress-step {
            flex: 1;
            height: 4px;
            background: var(--border, #444);
            border-radius: 2px;
            transition: background 0.3s;
        }
        .wizard-progress-step.active { background: var(--gold, #c9a84c); }
        .dynamic-row {
            display: flex;
            gap: 0.3rem;
            margin: 0.2rem 0;
            align-items: center;
            flex-wrap: wrap;
        }
        .dynamic-row input[type="text"] { flex: 1; min-width: 100px; }
        .dynamic-row input[type="number"] { width: 60px; }
        .wizard-remove-btn {
            padding: 0 0.4rem;
            background: transparent;
            border: none;
            color: var(--text2, #aaa);
            cursor: pointer;
            font-size: 1.2rem;
        }
        .wizard-remove-btn:hover { color: var(--red, #e74c3c); }
        .stat-item {
            background: var(--bg2, #2a2a2a);
            padding: 0.5rem;
            border-radius: 8px;
            text-align: center;
        }
        .field-hint { color: var(--text3, #888); font-size: 0.75rem; }
        .text-muted { color: var(--text2, #aaa); }
        .btn-sm { font-size: 0.8rem; padding: 0.2rem 0.6rem; }
        .btn-xs { font-size: 0.7rem; padding: 0.1rem 0.3rem; }
        .xp-budget-bar {
            padding: 0.5rem 0.8rem;
            border-radius: 6px;
            margin: 0.5rem 0;
            font-size: 0.85rem;
            border: 1px solid;
        }
        .xp-budget-ok {
            background: rgba(50,255,50,0.08);
            border-color: var(--green, #4caf50);
        }
        .xp-budget-over {
            background: rgba(255,50,50,0.1);
            border-color: var(--red, #e74c3c);
        }
        .info-box {
            background: var(--bg2, #2a2a2a);
            padding: 0.6rem 0.8rem;
            border-radius: 6px;
            border-left: 3px solid var(--gold, #c9a84c);
            margin: 0.5rem 0;
            font-size: 0.8rem;
            color: var(--text2, #aaa);
        }
        .heritage-note {
            font-size: 0.75rem;
            color: var(--text3, #888);
            margin-top: 0.2rem;
            padding: 0.3rem 0.5rem;
            background: rgba(255,255,255,0.03);
            border-radius: 4px;
            border-left: 2px solid var(--gold, #c9a84c);
        }
        .talent-catalog {
            max-height: 200px;
            overflow-y: auto;
            border: 1px solid var(--border, #444);
            border-radius: 6px;
            background: var(--bg2);
            margin-bottom: 0.5rem;
        }
        .talent-catalog-item {
            display: flex;
            align-items: center;
            padding: 0.3rem 0.5rem;
            font-size: 0.8rem;
            border-bottom: 1px solid var(--border);
        }
        .talent-catalog-item:last-child { border-bottom: none; }
        .talent-catalog-item .talent-info { flex: 1; }
        .talent-catalog-item .btn-xs { margin-left: 0.3rem; }
        /* Cantor fields style */
        .cantor-fields {
            border-top: 1px solid var(--border, #444);
            margin-top: 0.5rem;
            padding-top: 0.4rem;
        }
        .cantor-fields h5 { margin: 0 0 0.2rem; font-size: 0.85rem; }
    `,document.head.appendChild(e)}function ie(){let e=document.getElementById("wizardModal");return e||(Ce(),e=document.createElement("div"),e.id="wizardModal",e.setAttribute("role","dialog"),e.setAttribute("aria-modal","true"),e.style.display="none",e.innerHTML=`
        <div class="wizard-content">
            <button id="wizardModalClose" class="btn btn-secondary editor-back">← Cancel</button>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
                <h3 id="wizard-title" style="margin:0;">Character Wizard</h3>
            </div>
            <div id="wizard-progress" style="display:flex;gap:0.5rem;margin-bottom:1.2rem;justify-content:center;">
                ${[1,2,3,4,5].map(()=>'<div class="wizard-progress-step"></div>').join("")}
            </div>
            <div id="wizard-steps"></div>
            <div style="display:flex;justify-content:space-between;margin-top:1.2rem;padding-top:0.8rem;border-top:1px solid var(--border, #444);">
                <button id="wizard-back" class="btn btn-secondary">← Back</button>
                <button id="wizard-next" class="btn btn-gold">Next →</button>
            </div>
        </div>
    `,(document.getElementById("app-content")||document.body).appendChild(e),e)}function se(){s._listeners.forEach(({el:e,event:t,fn:a})=>e.removeEventListener(t,a)),s._listeners=[]}function $(e,t,a){e&&(e.addEventListener(t,a),s._listeners.push({el:e,event:t,fn:a}))}async function Ee(){try{try{await ke(),w=null,console.log("[Wizard] Patron data loaded")}catch(a){console.warn("[Wizard] Failed to load patron data, using fallback:",a)}const e=ie();s.modal=e,s.data={id:we(),name:"",heritage:"human",heritageNote:C.find(a=>a.id==="human")?.note||"",region:"",culturalAffinity:"",background:"",backgroundTags:"",backgroundContact:"",backgroundBoon:"",backgroundObligation:"",patron:"",magicPath:"none",magicPathNote:k.find(a=>a.id==="none")?.note||"",tier:"I",tierName:"Novice",totalXp:32,startingXp:32,body:1,wits:1,spirit:1,presence:1,skills:oe(),talents:[],assets:[],equipment:[],bonds:[],complications:[],harm:0,fatigue:0,fatigueMax:1,boons:0,obligation:0,obligationCapacity:2,corruption:0,corruptionMax:1,corruptionTier:0,boundSpirits:[],leashCapacity:4,leash:0,mentalStrain:0,mentalStrainMax:1,armorType:"none",shieldType:"none",weaponClass:"light",armorConversion:"Harm passes directly",vtt:!0,symbols:[],symbolStates:{},rites:[],thiasos:"",codex:"",repertoire:[],hedgeGifts:[],shadow:0,shame:0,identityStrain:0,promiseTimers:[],psionicArts:[],monasticTradition:"",breathState:"entering",monkCorruptionTier:0,knownTags:[],boundPatron:"",boundPatronBonus:1,bloomCount:0,resonantRites:[],learnedTalents:[],strings:[],debtTimers:[],spellbook:[],_stepDataCollected:{}},s.step=0,s.isOpen=!0;const t=document.getElementById("app-content")||document.body;s._hiddenSiblings=Array.from(t.children).filter(a=>a!==e),s._hiddenSiblings.forEach(a=>{a.style.display="none"}),e.classList.add("open"),e.style.display="block",window.scrollTo({top:0}),E(),Ye()}catch(e){console.error("[Wizard] openWizard error:",e),f("Could not open the character wizard: "+(e.message||e),"error")}}function X(){s.isOpen=!1,se();const e=s.modal||document.getElementById("wizardModal");e&&(e.classList.remove("open"),e.style.display="none"),s._hiddenSiblings&&(s._hiddenSiblings.forEach(t=>{t.style.display=""}),s._hiddenSiblings=null),s.data=null,s.step=0}function D(){s.step>0&&s.data&&(le(),s.step--,E())}function W(){if(!s.data){f("Wizard not initialized.","error");return}le()&&(s.step<4?(s.step++,E()):Re())}function le(){const e=s.data;if(!e)return!1;try{switch(s.step){case 0:return Te(e);case 1:return Be(e);case 2:return Ae(e);case 3:return Xe(e);default:return Me(e)}}catch(t){return console.error("[Wizard] collect error:",t),f("Error collecting data. Try again.","error"),!1}}function Te(e){const t=document.querySelector("#wz-name"),a=t?.value.trim()||"";return a?(e.name=a,e.heritage=b("#wz-heritage")||"human",e.heritageNote=C.find(n=>n.id===e.heritage)?.note||"",e.region=b("#wz-region"),e.culturalAffinity=b("#wz-cultural-affinity"),e.background=b("#wz-background"),e.backgroundTags=b("#wz-background-tags"),e.backgroundContact=b("#wz-background-contact"),e.backgroundBoon=b("#wz-background-boon"),e.backgroundObligation=b("#wz-background-obligation"),e._stepDataCollected[0]=!0,!0):(f("Character name is required.","error"),t&&(t.style.borderColor="var(--red)",t.focus(),setTimeout(()=>t.style.borderColor="",3e3)),!1)}function Be(e){return e.body=S(x("#wz-body"),1,5),e.wits=S(x("#wz-wits"),1,5),e.spirit=S(x("#wz-spirit"),1,5),e.presence=S(x("#wz-presence"),1,5),e.fatigueMax=e.body,e.obligationCapacity=e.spirit+e.presence,e.corruptionMax=e.spirit,e.mentalStrainMax=e.spirit,e._stepDataCollected[1]=!0,!0}function Ae(e){return e.skills||(e.skills=oe()),B.forEach(t=>{const a=t.toLowerCase(),n=x(`#wz-sk-${a}`);e.skills[a]=S(n,0,5)}),e._stepDataCollected[2]=!0,!0}function Xe(e){if(e.talents=I(),e.assets=J("wz-asset"),e.equipment=J("wz-equip"),e.magicPath=b("#wz-magic-path")||"none",e.magicPathNote=k.find(a=>a.id===e.magicPath)?.note||"",e.patron=b("#wz-patron"),e.thiasos=b("#wz-thiasos").trim(),e.codex=b("#wz-codex").trim(),e.magicPath==="runekeeper"&&!e.patron){const a=Pe({thiasos:e.thiasos,codex:e.codex});if(a){e.patron=a;const n=document.querySelector("#wz-patron");n&&(n.value=a),f(`🔮 Patron auto-set to ${a} from Thiasos/Codex.`,"info")}else(e.thiasos||e.codex)&&f("⚠️ Thiasos/Codex selected but patron could not be auto-detected. Please select a patron.","warning")}e.boundPatron=b("#wz-bound-patron"),e.boundPatronBonus=S(x("#wz-bound-patron-bonus"),0,3),e.bloomCount=Math.max(0,x("#wz-bloom-count"));const t=b("#wz-resonant-rites");return e.resonantRites=t?t.split(",").map(a=>a.trim()).filter(Boolean):[],e.armorType=b("#wz-armor-type")||"none",e.shieldType=b("#wz-shield-type")||"none",e.weaponClass=b("#wz-weapon-class")||"light",e.armorConversion=R.find(a=>a.id===e.armorType)?.conversion||"",e.symbols=Ie(),e._stepDataCollected[3]=!0,!0}function Ie(){const e=[];return document.querySelectorAll(".wz-symbol-row").forEach(t=>{const a=t.querySelector(".wz-symbol-id"),n=a?a.textContent.trim():"";n&&e.push(n)}),e}function Me(e){e.bonds=de(),e.complications=ce(),e._stepDataCollected[4]=!0;const t=Math.min(e.bonds.filter(o=>o.start).length,2),a=Math.min(e.complications.filter(o=>o.start).length,2);e.startingXp=Math.min(32+t*2+a*2,36);const n=v(e);if(n>e.startingXp){const o=n-e.startingXp;f(`Character is ${o} XP over budget (${n} spent, ${e.startingXp} available). You can still save — GM may allow.`,"warning")}return!0}function b(e){const t=document.querySelector(e);return t?t.value:""}function x(e){const t=document.querySelector(e);return t?g(t.value,0):0}function J(e){const t=[];return document.querySelectorAll(`.${e}-row`).forEach(a=>{const n=a.querySelector(`.${e}-name`)||a.querySelector('input[type="text"]'),o=a.querySelector(`.${e}-cost`)||a.querySelector('input[type="number"]'),i=n?.value.trim()||"",r=o?g(o.value,0):0;i&&t.push({name:i,cost:r})}),t}function I(){const e=[];return document.querySelectorAll(".wz-talent-row").forEach(t=>{const a=t.querySelector(".wz-talent-name"),n=t.querySelector(".wz-talent-cost"),o=a?a.tagName==="INPUT"?a.value.trim():a.textContent.trim():"",i=n?g(n.value||n.textContent,0):0;o&&e.push({name:o,cost:i})}),e}function de(){const e=[];let t=0;return document.querySelectorAll(".wz-bond-row").forEach(a=>{const n=a.querySelector(".wz-bond-name")?.value.trim()||"";if(!n)return;const o=(a.querySelector(".wz-bond-start")?.checked||!1)&&t<2;o&&t++,e.push({name:n,desc:a.querySelector(".wz-bond-desc")?.value.trim()||"",start:o})}),e}function ce(){const e=[];let t=0;return document.querySelectorAll(".wz-comp-row").forEach(a=>{const n=a.querySelector(".wz-comp-name")?.value.trim()||"";if(!n)return;const o=(a.querySelector(".wz-comp-start")?.checked||!1)&&t<2;o&&t++,e.push({name:n,desc:a.querySelector(".wz-comp-desc")?.value.trim()||"",start:o})}),e}function Re(){const e=s.data;if(!e){f("No character data to save.","error");return}if(!e.name||!e.name.trim()){f("Character name is required.","error"),s.step=0,E();return}const t=Math.min((e.bonds||[]).filter(r=>r.start).length,2),a=Math.min((e.complications||[]).filter(r=>r.start).length,2);e.startingXp=Math.min(32+t*2+a*2,36),e.totalXp=e.startingXp;const n=H(e.totalXp);e.tier=n.tier,e.tierName=n.name,e.fatigueMax=e.body,e.obligationCapacity=e.spirit+e.presence,e.corruptionMax=e.spirit,e.mentalStrainMax=e.spirit,e.xpSpent=v(e);const o={runekeeper:["familiar","codex"],"familiar-only":["familiar"],cantor:["cantors-path"],summoner:["pact-whisperer","lesser-pactwright"],"free-caster":["spellcraft"],witch:["craft-of-the-hedge"],"hedge-gifts":["craft-of-the-hedge"],invoker:[],psion:["psionic-training"],monk:["monastic-training"]};e.magicPath&&o[e.magicPath]&&(e.learnedTalents||(e.learnedTalents=[]),o[e.magicPath].forEach(r=>{e.learnedTalents.includes(r)||e.learnedTalents.push(r)}));const i=document.getElementById("wz-push-vtt");if(i&&(e.vtt=i.checked),!(e.xpSpent>e.startingXp&&!confirm(`This character is ${e.xpSpent-e.startingXp} XP over budget.
Spent: ${e.xpSpent} XP | Available: ${e.startingXp} XP

Save anyway? (GM may allow overspend.)`)))try{if(xe(e),f(`✨ "${e.name}" created! Tier ${e.tier} (${e.tierName}), ${e.totalXp} XP.`,"success"),X(),ze(()=>import("./characters.D4g1AIH0.js").then(r=>{r.renderCharList&&r.renderCharList()}),__vite__mapDeps([0,1,2,3,4,5])).catch(()=>{}),e.vtt){const r=document.querySelector('.sidebar-nav button[data-tab="vtt"]');r&&setTimeout(()=>r.click(),300)}}catch(r){console.error("[Wizard] Save error:",r),f("Error saving character. Please try again.","error")}}function E(){const e=s.data;if(!e)return;const t=document.getElementById("wizard-steps"),a=document.getElementById("wizard-next"),n=document.getElementById("wizard-back"),o=document.getElementById("wizard-title");if(!t||!a||!n)return;o.textContent=`Character Wizard — Step ${s.step+1}: ${["Identity","Attributes","Skills","Talents & Loadout","Bonds & Summary"][s.step]}`,n.style.display=s.step===0?"none":"inline-block",a.textContent=s.step===4?"✨ Finish":"Next →",document.querySelectorAll(".wizard-progress-step").forEach((l,m)=>{l.style.background=m<=s.step?"var(--gold)":"var(--border)"});let i="";try{switch(s.step){case 0:i=Le(e);break;case 1:i=Ne(e);break;case 2:i=Oe(e);break;case 3:i=_e(e);break;case 4:i=De(e);break;default:i="<p>Unknown step</p>"}}catch(l){console.error("[Wizard] Render error:",l),i='<p class="error">Error rendering step. Please refresh.</p>'}t.innerHTML=i,s.step===1&&We(),s.step===2&&Fe(),s.step===3&&He(),s.step===4&&z();const r=t.querySelector("input, select, textarea");r&&setTimeout(()=>r.focus(),100)}function F(e){const t=v(e),a=re(e),n=a-t,o=n<0;return`
        <div class="xp-budget-bar ${o?"xp-budget-over":"xp-budget-ok"}">
            <strong>XP Budget:</strong> ${a} available − ${t} spent = 
            <span style="color:${o?"var(--red)":"var(--green)"};font-weight:bold;">
                ${n>0?n+" remaining":n===0?"exactly spent":Math.abs(n)+" OVER!"}
            </span>
        </div>
    `}function Le(e){const t=C.map(o=>`<option value="${o.id}" ${e.heritage===o.id?"selected":""}>${d(o.label)}</option>`).join(""),a=$e.map(o=>`<option value="${o}" ${e.region===o?"selected":""}>${o||"Select region…"}</option>`).join(""),n=C.find(o=>o.id===e.heritage);return`
        <div>
            <h3 style="margin-top:0;">🪪 Step 1 — Identity & Concept</h3>
            <div class="info-box">
                Write one sentence describing your character's origin, profession, and one defining trait.
                Choose your ancestry — each heritage provides attribute adjustments and special abilities.
            </div>
            
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.8rem;margin-top:0.5rem;">
                <div>
                    <label>Name <span style="color:var(--red);">*</span></label>
                    <input id="wz-name" value="${d(e.name)}" placeholder="Enter character name..." autofocus />
                    <span class="field-hint">Required</span>
                </div>
                <div>
                    <label>Heritage / Ancestry</label>
                    <select id="wz-heritage">${t}</select>
                    <div class="heritage-note" id="wz-heritage-note">
                        <strong>Adjustments:</strong> ${d(n?.adj||"None")}<br>
                        ${d(n?.note||"")}
                    </div>
                </div>
                <div>
                    <label>Region of Origin</label>
                    <select id="wz-region">${a}</select>
                    <span class="field-hint">Grants a once-per-session cultural benefit</span>
                </div>
                <div>
                    <label>Cultural Affinity</label>
                    <input id="wz-cultural-affinity" value="${d(e.culturalAffinity||"")}" placeholder="Specific cultural trait or benefit" />
                </div>
            </div>
            
            <h4 style="margin:0.8rem 0 0.3rem;">Background</h4>
            <div class="info-box" style="font-size:0.75rem;">
                Backgrounds provide: 2 Access Tags, 1 Signature Contact (+1d assist once/scene), 
                1 Background Boon (+1d or DV−1 once/session), 1 Obligation Timer [4] (starting complication).
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;">
                <div>
                    <label>Background Name</label>
                    <input id="wz-background" value="${d(e.background||"")}" placeholder="e.g., Marcher Veteran, Merchant Factor" />
                </div>
                <div>
                    <label>Background Tags</label>
                    <input id="wz-background-tags" value="${d(e.backgroundTags||"")}" placeholder="e.g., Veteran-of-the-Marches, Muster Papers" />
                </div>
                <div>
                    <label>Signature Contact</label>
                    <input id="wz-background-contact" value="${d(e.backgroundContact||"")}" placeholder="Named NPC (Cap 1, +1d assist)" />
                </div>
                <div>
                    <label>Background Boon</label>
                    <input id="wz-background-boon" value="${d(e.backgroundBoon||"")}" placeholder="Once/session: +1d or DV−1" />
                </div>
                <div style="grid-column:1/-1;">
                    <label>Obligation Timer [4] Seed</label>
                    <input id="wz-background-obligation" value="${d(e.backgroundObligation||"")}" placeholder="Starting complication: what debt follows you?" />
                </div>
            </div>
        </div>
    `}function Ne(e){return`
        <div>
            <h3 style="margin-top:0;">⚡ Step 2 — Attributes (1–5)</h3>
            <div class="info-box">
                <strong>Cost:</strong> Each step costs new rating × 3 XP. Base is 1 each.
                <br>1→2 = 6 XP | 2→3 = 9 XP | 3→4 = 12 XP | 4→5 = 15 XP
                <br><strong>Recommended:</strong> Primary attribute at 3 (15 XP), secondary at 2 (6 XP each).
            </div>
            ${F(e)}
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:0.6rem;margin-top:0.5rem;">
                ${[{id:"body",name:"Body",desc:"Physical strength, endurance, coordination",skills:"Melee, Unarmed, Athletics, Endurance"},{id:"wits",name:"Wits",desc:"Mental acuity, perception, quick thinking",skills:"Ranged, Stealth, Craft, Subterfuge, Lore, Investigation, Medicine"},{id:"spirit",name:"Spirit",desc:"Willpower, intuition, magical aptitude",skills:"Insight, Arcana"},{id:"presence",name:"Presence",desc:"Charisma, social influence, force of personality",skills:"Sway, Deception, Performance"}].map(t=>{const a=e[t.id]??1,n=P(1,a);return`
                        <div class="stat-item" style="text-align:left;">
                            <label style="font-weight:600;font-size:0.9rem;">${t.name}</label>
                            <input type="number" id="wz-${t.id}" value="${a}" min="1" max="5" 
                                style="width:100%;text-align:center;font-size:1.2rem;" 
                                data-attr="${t.id}" />
                            <div style="font-size:0.7rem;color:var(--text3);margin-top:0.2rem;">
                                ${t.desc}
                            </div>
                            <div style="font-size:0.7rem;color:var(--gold);margin-top:0.2rem;" id="wz-${t.id}-cost">
                                ${a>1?`${n} XP spent`:"Base (free)"}
                            </div>
                            <div style="font-size:0.65rem;color:var(--text3);">
                                Skills: ${t.skills}
                            </div>
                        </div>
                    `}).join("")}
            </div>
            <div class="info-box" style="margin-top:0.5rem;">
                <strong>Derived Stats:</strong>
                Fatigue Track = Body (${e.body||1}) |
                Obligation Capacity = Spirit + Presence (${(e.spirit||1)+(e.presence||1)}) |
                Corruption Timer = Spirit (${e.spirit||1})
            </div>
        </div>
    `}function Oe(e){return`
        <div>
            <h3 style="margin-top:0;">📚 Step 3 — Skills (0–5)</h3>
            <div class="info-box">
                <strong>Cost:</strong> Each step costs new level × 2 XP. Base is 0.
                <br>0→1 = 2 XP | 1→2 = 4 XP | 2→3 = 6 XP | 3→4 = 8 XP | 4→5 = 10 XP
                <br><strong>Cap:</strong> Skill rating cannot exceed its primary Attribute.
                <br><strong>Recommended:</strong> Key skills at 2–3, others at 0–1. Spend 8–12 XP on skills.
            </div>
            ${F(e)}
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:0.4rem;margin-top:0.3rem;">
                ${B.map(t=>{const a=t.toLowerCase(),n=e.skills?.[a]??0,o=te[a]||"wits",i=o.charAt(0).toUpperCase()+o.slice(1),r=e[o]||1,l=_(0,n);return`
            <div style="display:flex;align-items:center;gap:0.3rem;background:var(--bg2);padding:0.2rem 0.4rem;border-radius:4px;${n>r?"border:1px solid var(--red);":""}">
                <div style="flex:1;">
                    <label style="font-size:0.85rem;font-weight:500;">${d(t)}</label>
                    <div style="font-size:0.65rem;color:var(--text3);">${i}</div>
                </div>
                <input type="number" id="wz-sk-${a}" value="${n}" min="0" max="5" 
                    style="width:60px;text-align:center;" data-skill="${a}" data-attr="${o}" />
                <div style="font-size:0.65rem;color:var(--gold);width:50px;text-align:right;" id="wz-sk-${a}-cost">
                    ${n>0?`${l}XP`:"—"}
                </div>
            </div>
        `}).join("")}
            </div>
            <div style="font-size:0.75rem;color:var(--text3);margin-top:0.5rem;">
                ⚠ Red border = skill exceeds its Attribute cap (GM may allow). 
                Dice Pool = Attribute + Skill. Recommended: keep key skills at 2–3 for 5-die pools.
            </div>
        </div>
    `}function qe(e){const t=ee(),a=t.talents||[],n=(t.wikiEntries||[]).filter(l=>l.tags&&Array.isArray(l.tags)&&l.tags.includes("talent")),o=[...a.map(l=>({...l,source:"local"})),...n.map(l=>({...l,name:l.title,description:l.body||l.description,source:"wiki"}))],i=H(v(e)).tier;let r=[];return i==="I"?r=["minor"]:i==="II"?r=["minor","major"]:r=["minor","major","prestige","epic"],o.filter(l=>{const m=g(l.cost,0);for(const u of ne)if(m>=u.min&&m<=u.max&&r.includes(u.id))return!0;return!1})}function je(e,{remainingXp:t,showStarterPicks:a}){return e.map(n=>{const o=g(n.cost,0),i=Array.isArray(n.tags)&&n.tags.includes("starter");return{...n,_recommended:a&&i,_affordable:t==null||o<=t}}).sort((n,o)=>{if(n._recommended!==o._recommended)return n._recommended?-1:1;if(n._affordable!==o._affordable)return n._affordable?-1:1;const i=g(n.cost,0)-g(o.cost,0);return i!==0?i:(n.name||"").localeCompare(o.name||"")})}function He(){const e=document.getElementById("wz-talent-catalog");if(!e||!s.data)return;const t=s.data,a=qe(t);if(a.length===0){e.innerHTML='<div class="text-muted" style="padding:0.5rem;">No talents available for your current tier.</div>';return}const n=v(t),o=g(t.totalXp,32)-n,i=je(a,{remainingXp:o,showStarterPicks:!(t.talents&&t.talents.length)});let r=!1;e.innerHTML=i.map(l=>{const m=g(l.cost,0),u=ne.find(L=>m>=L.min&&m<=L.max),p=u?u.label:"?";let h="";return l._recommended&&!r?(h='<div style="padding:0.25rem 0.5rem 0.1rem;font-size:0.65rem;font-weight:600;color:var(--gold);text-transform:uppercase;letter-spacing:0.03em;">⭐ Recommended starting talents</div>',r=!0):!l._recommended&&r&&(h='<div style="padding:0.35rem 0.5rem 0.1rem;font-size:0.65rem;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:0.03em;border-top:1px solid var(--border);">All talents</div>',r=!1),`
            ${h}
            <div class="talent-catalog-item" style="${l._affordable?"":"opacity:0.55;"}">
                <div class="talent-info">
                    ${l._recommended?'<span title="Common starting talent" style="margin-right:0.2rem;">⭐</span>':""}
                    <span style="font-weight:500;">${d(l.name)}</span>
                    <span style="color:var(--gold); margin-left:0.3rem;">${m} XP</span>
                    <span style="color:var(--text3); font-size:0.75rem; margin-left:0.3rem;">(${p})</span>
                    ${l._affordable?"":`<span style="color:var(--text3); font-size:0.7rem; margin-left:0.3rem;">— need ${m-o} more XP</span>`}
                    ${l.description?`<div style="color:var(--text2); font-size:0.7rem;">${d(l.description)}</div>`:""}
                    ${l.prerequisites?`<div style="color:var(--text3); font-size:0.65rem;">Requires: ${d(l.prerequisites)}</div>`:""}
                </div>
                <button class="btn btn-xs btn-primary catalog-add-btn" data-name="${d(l.name)}" data-cost="${m}" ${l._affordable?"":'title="Not enough remaining starting XP — you can still add it and adjust elsewhere"'}>Add</button>
            </div>
        `}).join(""),e.querySelectorAll(".catalog-add-btn").forEach(l=>{l.addEventListener("click",function(m){m.preventDefault();const u=this.dataset.name;O(u,parseInt(this.dataset.cost,10))})})}function O(e,t){const a=document.getElementById("wz-talent-list");if(!a||!s.data)return;const n=document.createElement("div");n.className="dynamic-row wz-talent-row",n.innerHTML=`
        <span class="wz-talent-name" style="flex:2; padding:0.2rem;">${d(e)}</span>
        <span class="wz-talent-cost" style="width:60px; text-align:center;">${t}</span>
        <button class="wizard-remove-btn">✕</button>
    `,a.appendChild(n),s.data.talents&&s.data.talents.push({name:e,cost:t}),M(),s.step===4&&setTimeout(z,50)}function G(){const e=document.getElementById("wz-talent-list");if(!e)return;const t=document.createElement("div");t.className="dynamic-row wz-talent-row",t.innerHTML=`
        <input type="text" class="wz-talent-name" placeholder="Talent name" style="flex:2;" />
        <input type="number" class="wz-talent-cost" placeholder="XP" value="0" min="0" style="width:60px;" />
        <button class="wizard-remove-btn">✕</button>
    `,e.appendChild(t);const a=t.querySelector('input[type="text"]');a&&setTimeout(()=>a.focus(),50)}function _e(e){const t=F(e),a=k.map(c=>`<option value="${c.id}" ${e.magicPath===c.id?"selected":""}>${d(c.label)}</option>`).join("");e.magicPath;const n=(e.symbols||[]).map((c,y)=>{const ve=T(c)||c;return`
            <div class="dynamic-row wz-symbol-row" data-index="${y}">
                <span class="wz-symbol-patron" style="flex:2; padding:0.2rem;">${d(ve)}</span>
                <span class="wz-symbol-id" style="flex:1; padding:0.2rem;color:var(--text3);">${d(c)}</span>
                <button class="wizard-remove-btn" data-remove-symbol="${c}">✕</button>
            </div>
        `}).join("");`${N().filter(c=>c.id).map(c=>`<option value="${c.id}">${d(c.label)}</option>`).join("")}${n}`;const o=Z(e.patron||""),i=Z(e.boundPatron||""),r=R.map(c=>`<option value="${c.id}" ${e.armorType===c.id?"selected":""}>${d(c.label)}</option>`).join(""),l=ae.map(c=>`<option value="${c.id}" ${e.shieldType===c.id?"selected":""}>${d(c.label)}</option>`).join(""),m=A.map(c=>`<option value="${c.id}" ${e.weaponClass===c.id?"selected":""}>${d(c.label)}</option>`).join(""),u=k.find(c=>c.id===e.magicPath),p=A.find(c=>c.id===e.weaponClass),h=(e.talents||[]).map((c,y)=>`
        <div class="dynamic-row wz-talent-row">
            <span class="wz-talent-name" style="flex:2; padding:0.2rem;">${d(c.name)}</span>
            <span class="wz-talent-cost" style="width:60px; text-align:center;">${c.cost}</span>
            <button class="wizard-remove-btn">✕</button>
        </div>
    `).join(""),L=(e.assets||[]).map((c,y)=>j("wz-asset",y,c.name,c.cost)).join(""),ue=(e.equipment||[]).map((c,y)=>j("wz-equip",y,c.name,c.cost)).join(""),U=e.thiasos||"",Y=e.codex||"",ge=e.magicPath==="runekeeper",be=e.magicPath==="cantor";e.boundPatron;const fe=e.boundPatronBonus??1,he=e.bloomCount||0,ye=(e.resonantRites||[]).join(", ");return`
        <div>
            <h3 style="margin-top:0;">🧩 Step 4 — Talents, Magic & Loadout</h3>
            ${t}
            
            <h4 style="margin:0.5rem 0 0.2rem;">🔮 Magic Path (Optional)</h4>
            <div class="info-box" style="font-size:0.75rem;">
                You don't need magic to be effective. A Body 3 + Melee 2 warrior rolls 5 dice with no talents.
                If you want magic, choose a path. Each path has different costs and risks.
                For advanced options (Invoker symbols, Cantor repertoire, etc.), use the full editor after creation.
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;">
                <div>
                    <label>Magic Path</label>
                    <select id="wz-magic-path">${a}</select>
                    <div class="field-hint" id="wz-magic-path-note" style="margin-top:0.2rem;">${d(u?.note||"")}</div>
                </div>
                <div>
                    <label>Patron</label>
                    <select id="wz-patron">${o}</select>
                    <div class="field-hint" style="margin-top:0.2rem;">
                        ${e.magicPath==="invoker"?"Runekeeper/Cantor only — Invokers use Symbols below.":"Patrons loaded from /data/patrons/"}
                    </div>
                </div>
            </div>
            
            <!-- ─── Runekeeper: Thiasos/Codex ────────────────────── -->
            <div id="wz-runekeeper-fields" style="display:${ge?"block":"none"}; margin-top:0.3rem;">
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;">
                    <div>
                        <label>Thiasos (Familiar)</label>
                        <input id="wz-thiasos" value="${d(U)}" placeholder="e.g., white-hound, garden-spider" />
                        <span style="font-size:0.65rem;color:var(--text3);">The patron's attention given form.</span>
                    </div>
                    <div>
                        <label>Codex</label>
                        <input id="wz-codex" value="${d(Y)}" placeholder="e.g., iron-bound-ledger, frame-loom" />
                        <span style="font-size:0.65rem;color:var(--text3);">The covenant made visible.</span>
                    </div>
                </div>
                ${U||Y?'<div style="font-size:0.65rem;color:var(--gold);margin-top:0.2rem;">💡 Patron will be auto-set from Thiasos/Codex if not selected.</div>':""}
            </div>
            
            <!-- ─── Cantor: Bound Patron & Bloom ─────────────────── -->
            <div id="wz-cantor-fields" style="display:${be?"block":"none"}; margin-top:0.3rem;">
                <div class="cantor-fields">
                    <h5>🎵 Bound Patron (talent)</h5>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;">
                        <div>
                            <label>Bound Patron</label>
                            <select id="wz-bound-patron">${i}</select>
                            <span style="font-size:0.65rem;color:var(--text3);">Set when Bound Patron talent is learned</span>
                        </div>
                        <div>
                            <label>Position Bonus</label>
                            <input type="number" id="wz-bound-patron-bonus" value="${fe}" min="0" max="3" />
                            <span style="font-size:0.65rem;color:var(--text3);">+1 die when singing bound patron's rites</span>
                        </div>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;margin-top:0.3rem;">
                        <div>
                            <label>Bloom Count (Fugal Self at 7+)</label>
                            <input type="number" id="wz-bloom-count" value="${he}" min="0" />
                        </div>
                        <div>
                            <label>Resonant Rites (comma-separated)</label>
                            <input id="wz-resonant-rites" value="${d(ye)}" placeholder="e.g., Cradle Song, Golden Tongue" />
                        </div>
                    </div>
                </div>
            </div>
            // ─── Invoker: Symbols ──────────────────────────────────────────────
            <div id="wz-invoker-fields" style="display:${e.magicPath==="invoker"?"block":"none"}; margin-top:0.3rem;">
                <div class="invoker-fields">
                    <h5>🎴 Invoker Symbols</h5>
                    <div class="info-box" style="font-size:0.75rem;">
                        Each symbol grants access to a patron's Borrowed Grace and rites. You can carry up to 4 symbols without penalty.
                        Symbols are assets that count toward your asset slots (but you may treat them as free for simplicity at creation).
                    </div>
                    <div style="display:flex; gap:0.4rem; margin-bottom:0.3rem;">
                        <select id="wz-add-symbol-select" style="flex:1;">
                            <option value="">— Select a patron —</option>
                            ${N().filter(c=>c.id).map(c=>`<option value="${c.id}">${d(c.label)}</option>`).join("")}
                        </select>
                        <button class="btn btn-sm btn-primary" id="wz-add-symbol-btn">➕ Add Symbol</button>
                    </div>
                    <div id="wz-symbol-list">
                        ${(e.symbols||[]).map(c=>{const y=T(c)||c;return`
                                <div class="dynamic-row wz-symbol-row" data-patron="${c}">
                                    <span class="wz-symbol-patron" style="flex:2; padding:0.2rem;">${d(y)}</span>
                                    <span class="wz-symbol-id" style="flex:1; padding:0.2rem;color:var(--text3);">${d(c)}</span>
                                    <button class="wizard-remove-btn" data-remove-symbol="${c}">✕</button>
                                </div>
                            `}).join("")}
                    </div>
                    <div style="font-size:0.65rem;color:var(--text3);margin-top:0.2rem;">
                        Symbols added here will appear as assets "Symbol of [Patron]" and will be available in the Spellcraft panel.
                    </div>
                </div>
            </div>

            <h4 style="margin:0.8rem 0 0.2rem;">⚔️ Combat Loadout</h4>
            <div class="info-box" style="font-size:0.75rem;">
                Starting gear (free): One set of clothing, a Light weapon, Light armor (if needed), 
                backpack, waterskin, 1d6 rations, utility knife, flint & steel, lantern/candle, 
                and tools for your skills.
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.5rem;">
                <div>
                    <label>Armor</label>
                    <select id="wz-armor-type">${r}</select>
                    <div class="field-hint" id="wz-armor-info"></div>
                </div>
                <div>
                    <label>Shield</label>
                    <select id="wz-shield-type">${l}</select>
                </div>
                <div>
                    <label>Weapon Class</label>
                    <select id="wz-weapon-class">${m}</select>
                    <div class="field-hint" id="wz-weapon-info">${p?.note||""} | Close: ${p?.close||""} | Near: ${p?.near||""}</div>
                </div>
            </div>
            
            <h4 style="margin:0.8rem 0 0.2rem;">🧠 Talents</h4>
            <div class="info-box" style="font-size:0.75rem;">
                Minor (2–3 XP): Small situational bonus | Major (4–6 XP): Strong upgrade | 
                Prestige (7–10 XP): Campaign-defining | Epic (11+ XP): Legendary.
                Start with 0–3 talents. Many concepts work perfectly with zero talents.
            </div>
            
            <div id="wz-talent-catalog" class="talent-catalog"></div>
            
            <div id="wz-talent-list">${h}</div>
            
            <div style="display:flex; gap:0.4rem;">
                <button class="btn btn-sm btn-secondary" id="wz-add-custom-talent">✏️ Add Custom Talent</button>
            </div>
            
            <h4 style="margin:0.8rem 0 0.2rem;">🏰 Assets (Optional)</h4>
            <div class="info-box" style="font-size:0.75rem;">
                Minor Asset (4 XP): Safehouse, workshop, contact network | 
                Standard (8 XP): Guild seat, spy ring | Major (12 XP): Fortress, charter.
                Most starting characters skip these or take one minor asset.
            </div>
            <div id="wz-asset-list">${L}</div>
            <button class="btn btn-sm btn-secondary" data-wizard-add="wz-asset">+ Add Asset</button>
            
            <h4 style="margin:0.8rem 0 0.2rem;">🎒 Additional Equipment</h4>
            <div id="wz-equip-list">${ue}</div>
            <button class="btn btn-sm btn-secondary" data-wizard-add="wz-equip">+ Add Equipment</button>
        </div>
    `}function De(e){const t=(e.bonds||[]).map((p,h)=>me(h,p)).join(""),a=(e.complications||[]).map((p,h)=>pe(h,p)).join(""),n=Math.min((e.bonds||[]).filter(p=>p.start).length,2),o=Math.min((e.complications||[]).filter(p=>p.start).length,2),i=Math.min(32+n*2+o*2,36),r=v(e),l=i-r,m=H(i),u=B.filter(p=>(e.skills?.[p.toLowerCase()]||0)>0).length;return`
        <div>
            <h3 style="margin-top:0;">📋 Step 5 — Bonds, Complications & Summary</h3>
            
            <h4 style="margin:0.3rem 0 0.2rem;">🤝 Bonds</h4>
            <div class="info-box" style="font-size:0.75rem;">
                Establish up to 2 bonds with other characters. Each bond grants <strong>+2 XP</strong> at creation (max +4 from bonds).
                In play: once per session per bond, act on it with intricate description → gain 1 Boon.
                At Tier III+: transfer up to 2 Boons to a bonded PC (once/scene).
            </div>
            <div id="wz-bond-list">${t}</div>
            <button class="btn btn-sm btn-secondary" data-wizard-add="wz-bond">+ Add Bond</button>
            
            <h4 style="margin:0.8rem 0 0.2rem;">⚠️ Complications</h4>
            <div class="info-box" style="font-size:0.75rem;">
                Take up to 2 complications (e.g., a feud, a cursed item, a debt). Each grants <strong>+2 XP</strong> at creation (max +4 from complications).
                <strong>Warning:</strong> Each unresolved starting Complication adds +1 banked Story Beat to early scenes.
                Maximum starting XP: <strong>36</strong> (32 base + 4 max from bonds/complications).
            </div>
            <div id="wz-comp-list">${a}</div>
            <button class="btn btn-sm btn-secondary" data-wizard-add="wz-comp">+ Add Complication</button>
            
            <h4 style="margin:1rem 0 0.3rem;">📊 Character Summary</h4>
            <div style="background:var(--bg2);padding:1rem;border-radius:var(--radius);">
                <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:0.5rem;">
                    <div>
                        <h4 style="margin:0 0 0.2rem;">${d(e.name||"Unnamed")}</h4>
                        <p style="margin:0;font-size:0.9rem;color:var(--text2);">
                            ${d(C.find(p=>p.id===e.heritage)?.label.split("—")[0]||"")}
                            ${e.region?" · "+d(e.region):""}
                            ${e.background?" · "+d(e.background):""}
                        </p>
                    </div>
                    <span style="background:${m.color||"var(--gold)"};color:#000;padding:0.2rem 0.8rem;border-radius:20px;font-weight:600;align-self:start;" id="wz-summary-tier">
                        Tier ${m.tier}: ${m.name}
                    </span>
                </div>
                <hr style="border-color:var(--border);margin:0.6rem 0;" />
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.3rem 1rem;font-size:0.85rem;">
                    <div><span class="text-muted">Attributes:</span> B${e.body} W${e.wits} S${e.spirit} P${e.presence}</div>
                    <div><span class="text-muted">Skills with ranks:</span> ${u}/16</div>
                    <div><span class="text-muted">Magic Path:</span> ${d(k.find(p=>p.id===e.magicPath)?.label.split("(")[0]||"None")}</div>
                    <div><span class="text-muted">Patron:</span> ${d(T(e.patron)||"None")}</div>
                    <div><span class="text-muted">Talents:</span> ${(e.talents||[]).length}</div>
                    <div><span class="text-muted">Assets:</span> ${(e.assets||[]).length}</div>
                    <div><span class="text-muted">Bonds:</span> ${(e.bonds||[]).length} (${n} for +XP)</div>
                    <div><span class="text-muted">Complications:</span> ${(e.complications||[]).length} (${o} for +XP)</div>
                    <div><span class="text-muted">Armor:</span> ${d(R.find(p=>p.id===e.armorType)?.label.split("(")[0]||"None")}</div>
                    <div><span class="text-muted">Weapon:</span> ${d(A.find(p=>p.id===e.weaponClass)?.label.split("(")[0]||"Light")}</div>
                    ${e.thiasos?`<div><span class="text-muted">Thiasos:</span> ${d(e.thiasos)}</div>`:""}
                    ${e.codex?`<div><span class="text-muted">Codex:</span> ${d(e.codex)}</div>`:""}
                    ${e.magicPath==="cantor"?`
                        <div><span class="text-muted">Bound Patron:</span> ${d(T(e.boundPatron)||"None")}</div>
                        <div><span class="text-muted">Bloom Count:</span> ${e.bloomCount||0}</div>
                        <div><span class="text-muted">Resonant Rites:</span> ${(e.resonantRites||[]).length}</div>
                    `:""}
                </div>
                <hr style="border-color:var(--border);margin:0.6rem 0;" />
                <div class="xp-budget-bar ${l<0?"xp-budget-over":"xp-budget-ok"}" id="wz-summary-xp-bar">
                    <strong>Starting XP:</strong> <span id="wz-summary-xp">${i}</span>
                    (32 base + ${n*2+o*2} bonus) |
                    <strong>Spent:</strong> <span id="wz-summary-spent">${r}</span> |
                    <strong style="color:${l<0?"var(--red)":"var(--green)"};" id="wz-summary-remaining">
                        ${l>0?l+" remaining":l===0?"exactly spent":Math.abs(l)+" OVER!"}
                    </strong>
                </div>
                <div style="display:flex;gap:1.5rem;flex-wrap:wrap;margin-top:0.5rem;">
                    <label><input type="checkbox" id="wz-push-vtt" ${e.vtt?"checked":""} /> Push to VTT</label>
                </div>
            </div>
            <div class="info-box" style="margin-top:0.5rem;font-size:0.8rem;">
                <strong>Starting Gear (free):</strong> ${Se.join(", ")}.
                <br><strong>Remember:</strong> Spend all starting XP — you cannot bank it.
                <br><strong>Advanced fields</strong> (Symbols, Rites, Repertoire, Hedge Gifts, etc.) can be added later in the editor.
            </div>
        </div>
    `}function T(e){if(!e)return null;const t=N().find(a=>a.id===e);return t?t.label:e}function We(){["body","wits","spirit","presence"].forEach(e=>{const t=document.getElementById(`wz-${e}`);t&&t.addEventListener("input",()=>{Ge(e),M(),Ue()})})}function Fe(){B.forEach(e=>{const t=e.toLowerCase(),a=document.getElementById(`wz-sk-${t}`);a&&a.addEventListener("input",()=>{Ve(t),M()})})}function Ge(e){const t=document.getElementById(`wz-${e}`),a=document.getElementById(`wz-${e}-cost`);if(!t||!a)return;const n=g(t.value,1),o=P(1,n);a.textContent=n>1?`${o} XP spent`:"Base (free)"}function Ve(e){const t=document.getElementById(`wz-sk-${e}`),a=document.getElementById(`wz-sk-${e}-cost`);if(!t||!a)return;const n=g(t.value,0),o=_(0,n),i=te[e],r=document.getElementById(`wz-${i}`);n>(r?g(r.value,1):1)?(t.style.borderColor="var(--red)",a.style.color="var(--red)"):(t.style.borderColor="",a.style.color="var(--gold)"),a.textContent=n>0?`${o}XP`:"—"}function M(){if(!s.data)return;const e=s.data;e.talents=I();const t=document.querySelector(".xp-budget-bar");if(t){const a=v(e),n=re(e),o=n-a,i=o<0;t.className=`xp-budget-bar ${i?"xp-budget-over":"xp-budget-ok"}`,t.innerHTML=`
            <strong>XP Budget:</strong> ${n} available − ${a} spent = 
            <span style="color:${i?"var(--red)":"var(--green)"};font-weight:bold;">
                ${o>0?o+" remaining":o===0?"exactly spent":Math.abs(o)+" OVER!"}
            </span>
        `}}function Ue(){const e=g(document.getElementById("wz-body")?.value,1),t=g(document.getElementById("wz-spirit")?.value,1),a=g(document.getElementById("wz-presence")?.value,1),n=document.querySelector(".info-box:last-of-type");n&&s.step===1&&(n.innerHTML=`
            <strong>Derived Stats:</strong>
            Fatigue Track = Body (${e}) |
            Obligation Capacity = Spirit + Presence (${t+a}) |
            Corruption Timer = Spirit (${t})
        `)}function z(){if(!s.data||s.step!==4)return;const e=s.data;e.talents=I(),e.bonds=de(),e.complications=ce();const t=Math.min(e.bonds.filter(p=>p.start).length,2),a=Math.min(e.complications.filter(p=>p.start).length,2),n=Math.min(32+t*2+a*2,36),o=v(e),i=n-o,r=document.getElementById("wz-summary-xp");r&&(r.textContent=n);const l=document.getElementById("wz-summary-spent");l&&(l.textContent=o);const m=document.getElementById("wz-summary-remaining");m&&(m.textContent=i>0?`${i} remaining`:i===0?"exactly spent":`${Math.abs(i)} OVER!`,m.style.color=i<0?"var(--red)":"var(--green)");const u=document.getElementById("wz-summary-xp-bar");u&&(u.className=`xp-budget-bar ${i<0?"xp-budget-over":"xp-budget-ok"}`)}function j(e,t,a="",n=0){return`
        <div class="dynamic-row ${e}-row" data-index="${t}">
            <input type="text" class="${e}-name" placeholder="Name" value="${d(a||"")}" style="flex:2;" />
            <input type="number" class="${e}-cost" placeholder="XP" value="${n||0}" min="0" style="width:60px;" title="XP cost" />
            <button class="wizard-remove-btn">✕</button>
        </div>
    `}function me(e,t={}){return`
        <div class="dynamic-row wz-bond-row" data-index="${e}">
            <input type="text" class="wz-bond-name" placeholder="Bond name (with PC or NPC)" value="${d(t.name||"")}" style="flex:1;min-width:100px;" />
            <input type="text" class="wz-bond-desc" placeholder="Description" value="${d(t.desc||"")}" style="flex:2;min-width:120px;" />
            <label style="font-size:0.8rem;display:flex;align-items:center;gap:0.2rem;" title="+2 XP at creation (max 2 bonds)">
                <input type="checkbox" class="wz-bond-start" ${t.start!==!1?"checked":""} /> +2 XP
            </label>
            <button class="wizard-remove-btn">✕</button>
        </div>
    `}function pe(e,t={}){return`
        <div class="dynamic-row wz-comp-row" data-index="${e}">
            <input type="text" class="wz-comp-name" placeholder="Complication name" value="${d(t.name||"")}" style="flex:1;min-width:100px;" />
            <input type="text" class="wz-comp-desc" placeholder="Description" value="${d(t.desc||"")}" style="flex:2;min-width:120px;" />
            <label style="font-size:0.8rem;display:flex;align-items:center;gap:0.2rem;" title="+2 XP at creation (max 2). Adds +1 banked SB to early scenes.">
                <input type="checkbox" class="wz-comp-start" ${t.start!==!1?"checked":""} /> +2 XP
            </label>
            <button class="wizard-remove-btn">✕</button>
        </div>
    `}function V(e){const t=document.getElementById(e+"-list");if(!t)return;const a=t.children.length;let n;e==="wz-bond"?n=me(a):e==="wz-comp"?n=pe(a):n=j(e,a);const o=document.createElement("div");o.innerHTML=n;const i=o.firstElementChild;t.appendChild(i);const r=i.querySelector('input[type="text"]');r&&setTimeout(()=>r.focus(),50),s.step===4&&setTimeout(z,50)}function Ye(){if(!(s.modal||document.getElementById("wizardModal")))return;se(),$(document.getElementById("wizard-back"),"click",D),$(document.getElementById("wizard-next"),"click",W),$(document.getElementById("wizardModalClose"),"click",X),$(document,"keydown",n=>{if(s.isOpen){if(n.key==="Escape")X();else if(n.key==="Enter"&&!n.target.matches("textarea")){const o=document.getElementById("wizard-next");o&&(n.preventDefault(),o.click())}}}),$(document,"click",n=>{const o=n.target;if(o.matches("[data-wizard-add]")){const i=o.dataset.wizardAdd;V(i),n.preventDefault();return}if(o.matches(".wizard-remove-btn")){const i=o.closest(".dynamic-row");if(i){const r=i.dataset.patron;if(r){if(s.data.symbols){s.data.symbols=s.data.symbols.filter(u=>u!==r);const l=T(r)||r,m=`Symbol of ${l}`;s.data.assets&&(s.data.assets=s.data.assets.filter(u=>u.name!==m)),E(),f(`Removed Symbol of ${l}`,"info")}}else i.remove(),s.data&&(s.data.talents=I()),M(),s.step===4&&setTimeout(z,50)}n.preventDefault();return}if(o.matches(".wz-bond-start, .wz-comp-start")){s.isOpen&&s.step===4&&setTimeout(z,50);return}if(o.matches("#wz-heritage")){const i=C.find(l=>l.id===o.value),r=document.getElementById("wz-heritage-note");r&&i&&(r.innerHTML=`<strong>Adjustments:</strong> ${d(i.adj)}<br>${d(i.note)}`);return}if(o.matches("#wz-magic-path")){const i=k.find(p=>p.id===o.value),r=document.getElementById("wz-magic-path-note");r&&i&&(r.textContent=i.note);const l=document.getElementById("wz-runekeeper-fields");l&&(l.style.display=o.value==="runekeeper"?"block":"none");const m=document.getElementById("wz-cantor-fields");m&&(m.style.display=o.value==="cantor"?"block":"none");const u=document.getElementById("wz-invoker-fields");u&&(u.style.display=o.value==="invoker"?"block":"none");return}if(o.matches("#wz-armor-type")){const i=R.find(l=>l.id===o.value),r=document.getElementById("wz-armor-info");r&&i&&(r.textContent=i.conversion);return}if(o.matches("#wz-weapon-class")){const i=A.find(l=>l.id===o.value),r=document.getElementById("wz-weapon-info");r&&i&&(r.textContent=`${i.note} | Close: ${i.close} | Near: ${i.near}`);return}if(o.matches(".catalog-add-btn")){const i=o.dataset.name;O(i,parseInt(o.dataset.cost,10)),n.preventDefault();return}if(o.matches("#wz-add-custom-talent")){G(),n.preventDefault();return}if(o.matches("#wz-add-symbol-btn")){const i=document.getElementById("wz-add-symbol-select");if(!i)return;const r=i.value;if(!r){f("Please select a patron.","warning");return}if(s.data.symbols||(s.data.symbols=[]),s.data.symbols.includes(r)){f("Symbol already added.","info");return}s.data.symbols.push(r);const l=T(r)||r,m=`Symbol of ${l}`;s.data.assets||(s.data.assets=[]),s.data.assets.some(u=>u.name===m)||s.data.assets.push({name:m,cost:0}),E(),f(`Added Symbol of ${l}`,"success"),n.preventDefault();return}}),$(document,"input",n=>{s.isOpen&&(n.target.matches(".wz-talent-name, .wz-talent-cost")&&(s.data.talents=I(),M(),s.step===4&&setTimeout(z,50)),s.step===4&&n.target.matches(".wz-bond-name, .wz-bond-desc, .wz-comp-name, .wz-comp-desc")&&setTimeout(z,50))})}ie();Object.assign(window,{addWizardDynamic:V,wizardBack:D,wizardNext:W,closeWizard:X,addTalentFromCatalog:O,addCustomTalentRow:G});var tt={openWizard:Ee,closeWizard:X,wizardBack:D,wizardNext:W,addWizardDynamic:V,addTalentFromCatalog:O,addCustomTalentRow:G};export{G as addCustomTalentRow,O as addTalentFromCatalog,V as addWizardDynamic,X as closeWizard,tt as default,Ee as openWizard,D as wizardBack,W as wizardNext};
