import{a as _,g as ce,i as u,l as le}from"./utils.lBShoim5.js";import{D as W,b as D,g as de,j as G}from"./state.42sFgcOQ.js";import{n as c}from"./Toast.DDAtBIAw.js";import{t as P}from"./vtt-store.Dch8u3Zx.js";async function Q(e=!1){const n=D();if(!(n.wikiEntries&&!e))try{const t=await fetch("/data/wiki.json");if(!t.ok)throw new Error(`HTTP ${t.status}`);const i=await t.json();n.wikiEntries=i.data||[],n.wikiData=i,W()}catch(t){console.warn("[Crafting] Failed to load wiki.json, using fallback data.",t),n.wikiEntries=[...fe],n.wikiData={data:n.wikiEntries},W()}}var K={Herbs:{name:"Herbs",cost:0,common:!0,icon:"🌿",description:"A bundle of common medicinal herbs."},"Clean cloth":{name:"Clean cloth",cost:0,common:!0,icon:"🧻",description:"Linen or cotton cloth, sterile."},Chamomile:{name:"Chamomile",cost:0,common:!0,icon:"🌼",description:"Dried chamomile flowers; calming."},Lavender:{name:"Lavender",cost:0,common:!0,icon:"💜",description:"Fragrant purple flowers; soothing."},Mint:{name:"Mint",cost:0,common:!0,icon:"🌱",description:"Fresh or dried mint leaves."},Rosemary:{name:"Rosemary",cost:0,common:!0,icon:"🌿",description:"Pungent herb; memory and purification."},Sage:{name:"Sage",cost:0,common:!0,icon:"🌿",description:"Common culinary and ritual herb."},Thyme:{name:"Thyme",cost:0,common:!0,icon:"🌿",description:"Fragrant, antiseptic."},Moonwort:{name:"Moonwort",cost:1,common:!1,icon:"🌙",description:"Silver-veined herb that grows only under full moon."},Nightshade:{name:"Nightshade",cost:1,common:!1,icon:"☠️",description:"A dark, poisonous plant; used sparingly."},"Valerian root":{name:"Valerian root",cost:0,common:!0,icon:"🌰",description:"Root that induces sleep and calm."},Belladonna:{name:"Belladonna",cost:1,common:!1,icon:"🍇",description:"Deadly nightshade; potent and dangerous."},Salt:{name:"Salt",cost:0,common:!0,icon:"🧂",description:"Coarse sea salt; purifying."},"Iron filings":{name:"Iron filings",cost:0,common:!0,icon:"⚙️",description:"Fine iron shavings; magnetic and warding."},Charcoal:{name:"Charcoal",cost:0,common:!0,icon:"🪵",description:"Burnt wood; absorbent."},Sulphur:{name:"Sulphur",cost:0,common:!0,icon:"🟡",description:"Yellow powder; flammable."},Saltpetre:{name:"Saltpetre",cost:0,common:!0,icon:"🧪",description:"Potassium nitrate; explosive."},Clay:{name:"Clay",cost:0,common:!0,icon:"🏺",description:"Mouldable earth; for tablets and vessels."},Quicksilver:{name:"Quicksilver",cost:1,common:!1,icon:"💧",description:"Liquid mercury; volatile and conductive."},Orpiment:{name:"Orpiment",cost:1,common:!1,icon:"🟠",description:"Bright yellow mineral; toxic and transformative."},Lodestone:{name:"Lodestone",cost:1,common:!1,icon:"🧲",description:"Magnetic stone; attracts and guides."},Blood:{name:"Blood",cost:0,common:!0,icon:"🩸",description:"Fresh blood (any source)."},"Bone dust":{name:"Bone dust",cost:0,common:!0,icon:"🦴",description:"Ground bone; structural."},Tallow:{name:"Tallow",cost:0,common:!0,icon:"🕯️",description:"Rendered animal fat; for candles and ointments."},Feathers:{name:"Feathers",cost:0,common:!0,icon:"🪶",description:"Bird feathers; light and insulating."},"Dragon’s blood":{name:"Dragon’s blood",cost:3,common:!1,icon:"🐉",description:"A drop from a true dragon; legendary."},"Phoenix feather":{name:"Phoenix feather",cost:3,common:!1,icon:"🦅",description:"A feather of a phoenix; renewal."},"Distilled water":{name:"Distilled water",cost:0,common:!0,icon:"💧",description:"Pure water, free of impurities."},Alcohol:{name:"Alcohol",cost:0,common:!0,icon:"🍷",description:"High-proof spirit; solvent."},Vinegar:{name:"Vinegar",cost:0,common:!0,icon:"🍶",description:"Acidic liquid; preservative."},"Olive oil":{name:"Olive oil",cost:0,common:!0,icon:"🫒",description:"Pure oil; base for ointments."},"Aqua Regia":{name:"Aqua Regia",cost:2,common:!1,icon:"🧪",description:"Royal water; dissolves metals."},"Essence of Shadow":{name:"Essence of Shadow",cost:2,common:!1,icon:"🌑",description:"Congealed darkness; elusive."},Moonwater:{name:"Moonwater",cost:0,common:!0,icon:"🌙",description:"Water blessed by moonlight; enchanted."},"Blessed ash":{name:"Blessed ash",cost:0,common:!0,icon:"🔥",description:"Ashes from a sacred fire."},Incense:{name:"Incense",cost:0,common:!0,icon:"🪔",description:"Fragrant resin; for rituals."},Honey:{name:"Honey",cost:0,common:!0,icon:"🍯",description:"Sweet, preserving, and healing."},Sunbeam:{name:"Sunbeam",cost:2,common:!1,icon:"☀️",description:"Captured sunlight; dispels darkness."},"Essence of Life":{name:"Essence of Life",cost:2,common:!1,icon:"💚",description:"Vital energy; rare and potent."},"Rare herb":{name:"Rare herb",cost:1,common:!1,icon:"🌱",description:"A generic rare herb (for fallback)."},"Pure water":{name:"Pure water",cost:0,common:!0,icon:"💧",description:"Clean water (fallback)."},Garlic:{name:"Garlic",cost:0,common:!0,icon:"🧄",description:"Pungent bulb; wards evil."},Ginger:{name:"Ginger",cost:0,common:!0,icon:"🫚",description:"Spicy root; warming."},Cinnamon:{name:"Cinnamon",cost:0,common:!0,icon:"🪵",description:"Sweet bark; for potions."},Clove:{name:"Clove",cost:0,common:!0,icon:"🌼",description:"Aromatic spice; numbing."},Myrrh:{name:"Myrrh",cost:0,common:!0,icon:"🪔",description:"Resin; used in rites."},Frankincense:{name:"Frankincense",cost:0,common:!0,icon:"🪔",description:"Resin; for sacred smoke."}},Y={"healing-poultice":{id:"healing-poultice",name:"🩹 Healing Poultice",description:"A balm of herbs and salves that speeds recovery.",effect:"Remove 1 Fatigue when applied during a short rest.",ingredients:["Herbs","Clean cloth"],skill:"medicine",dv:2,xpCost:1,tier:"minor",icon:"🩹"},antidote:{id:"antidote",name:"🧪 Antidote",description:"A bitter draught that neutralises common poisons.",effect:"Remove one Poisoned Condition.",ingredients:["Rare herb","Distilled water","Charcoal"],skill:"medicine",dv:3,xpCost:2,tier:"minor",icon:"🧪"},"sleep-draught":{id:"sleep-draught",name:"💤 Sleep Draught",description:"A sweet syrup that induces deep, dreamless sleep.",effect:"Target tests Spirit+Resolve (DV 3) or falls asleep for 1 hour.",ingredients:["Valerian root","Honey","Moonwater"],skill:"craft",dv:3,xpCost:1,tier:"minor",icon:"💤"},"ward-salt":{id:"ward-salt",name:"🧂 Ward Salt",description:"Salt blessed with protective herbs and iron filings.",effect:"Line wards against spirits and undead (Spirit+Resolve DV 4 to cross).",ingredients:["Salt","Blessed ash","Iron filings"],skill:"lore",dv:3,xpCost:2,tier:"minor",icon:"🧂"},"truth-serum":{id:"truth-serum",name:"🔮 Truth Serum",description:"A clear liquid that loosens the tongue.",effect:"Target tests Spirit+Resolve (DV 4) or speaks only truth for one exchange.",ingredients:["Nightshade","Pure water","Blood"],skill:"craft",dv:4,xpCost:3,tier:"standard",icon:"🔮"},"moon-tea":{id:"moon-tea",name:"🌙 Moon Tea",description:"A calming infusion that sharpens dreams and intuition.",effect:"+1 die on next Wits or Spirit roll within 1 hour.",ingredients:["Chamomile","Moonwort","Honey"],skill:"craft",dv:2,xpCost:1,tier:"minor",icon:"🌙"},"fire-powder":{id:"fire-powder",name:"🔥 Fire Powder",description:"A volatile powder that ignites on contact with air.",effect:"Creates a small fire (Harm 2, Area) in Close range. One use.",ingredients:["Sulphur","Charcoal","Saltpetre"],skill:"craft",dv:4,xpCost:3,tier:"standard",icon:"🔥"},"blessed-oil":{id:"blessed-oil",name:"🕯️ Blessed Oil",description:"Oil consecrated to a Patron or Threshold.",effect:"Anoints a weapon or threshold; counts as [WARD] or [BLESSED] for one scene.",ingredients:["Olive oil","Incense"],skill:"lore",dv:3,xpCost:2,tier:"standard",icon:"🕯️"},"stimulant-draught":{id:"stimulant-draught",name:"⚡ Stimulant Draught",description:"A sharp, invigorating potion.",effect:"+1 die to all physical actions for the next scene.",ingredients:["Mint","Ginger","Distilled water"],skill:"craft",dv:3,xpCost:2,tier:"minor",icon:"⚡"},"clarity-tincture":{id:"clarity-tincture",name:"🧠 Clarity Tincture",description:"Clears the mind and sharpens wit.",effect:"+1 die to all mental actions for the next scene.",ingredients:["Rosemary","Chamomile","Moonwater"],skill:"craft",dv:3,xpCost:2,tier:"minor",icon:"🧠"},"invisibility-powder":{id:"invisibility-powder",name:"👻 Invisibility Powder",description:"A handful of shimmering dust.",effect:"When thrown, you and allies in Close become invisible for 1 exchange (or until you attack).",ingredients:["Moonwater","Iron filings","Salt"],skill:"arcana",dv:4,xpCost:3,tier:"standard",icon:"👻"},"frost-oil":{id:"frost-oil",name:"❄️ Frost Oil",description:"A slick, cold oil that freezes on contact.",effect:"Apply to a weapon: next hit deals +1 Harm (cold) and target moves at half speed for 1 turn.",ingredients:["Moonwater","Salt","Olive oil"],skill:"craft",dv:3,xpCost:2,tier:"minor",icon:"❄️"},"speed-syrup":{id:"speed-syrup",name:"💨 Speed Syrup",description:"A thick, sweet elixir.",effect:"+1 Move for the next scene.",ingredients:["Valerian root","Honey","Moonwater"],skill:"craft",dv:3,xpCost:2,tier:"minor",icon:"💨"},"healing-draught":{id:"healing-draught",name:"❤️‍🩹 Healing Draught",description:"A powerful restorative.",effect:"Restore 2 Fatigue when consumed during a short rest.",ingredients:["Herbs","Honey","Distilled water"],skill:"medicine",dv:3,xpCost:2,tier:"standard",icon:"❤️‍🩹"},"restorative-salve":{id:"restorative-salve",name:"🛡️ Restorative Salve",description:"Thick, green ointment.",effect:"Remove one ongoing minor Condition (e.g., Poisoned, Diseased) when applied.",ingredients:["Herbs","Clean cloth","Olive oil"],skill:"medicine",dv:3,xpCost:2,tier:"standard",icon:"🛡️"},"warding-incense":{id:"warding-incense",name:"🪔 Warding Incense",description:"Burning incense that creates a protective circle.",effect:"For 1 hour, any spirit or undead trying to cross the circle must test Spirit+Resolve DV 4.",ingredients:["Incense","Blessed ash","Salt"],skill:"lore",dv:3,xpCost:2,tier:"minor",icon:"🪔"},"bottled-squall":{id:"bottled-squall",name:"🌪️ Bottled Squall",description:"A corked jar holding a captive wind.",effect:"Uncork to create a burst of wind (Area, Near). Extinguishes flames and grants allies +1 Position to disengage.",ingredients:["Moonwater","Feathers","Salt"],skill:"arcana",dv:4,xpCost:3,tier:"standard",icon:"🌪️"},"chime-glass-vial":{id:"chime-glass-vial",name:"🔔 Chime-Glass Vial",description:"A fragile vial that sings when broken.",effect:"Shatter to reveal [WARD] boundaries and thin spots in the Weave within Near for one exchange.",ingredients:["Quicksilver","Clay","Moonwater"],skill:"arcana",dv:4,xpCost:3,tier:"standard",icon:"🔔"},"debtors-chalk":{id:"debtors-chalk",name:"✏️ Debtor's Chalk",description:"A stick of chalk that remembers promises.",effect:"Draw a line; anyone who crosses it while owing you a promise suffers –1 die on their next roll unless they acknowledge the debt aloud.",ingredients:["Salt","Blessed ash","Charcoal"],skill:"lore",dv:3,xpCost:2,tier:"minor",icon:"✏️"},"cairn-dust":{id:"cairn-dust",name:"🪦 Cairn Dust",description:"Dust from a sacred cairn.",effect:"Toss over a corpse: for the rest of the scene, that body cannot be reanimated, possessed, or read for necromantic sending.",ingredients:["Bone dust","Salt","Blessed ash"],skill:"lore",dv:3,xpCost:2,tier:"minor",icon:"🪦"},"nine-knot-twine":{id:"nine-knot-twine",name:"🧵 Nine-Knot Twine",description:"A braided cord with nine knots.",effect:"Tie around a wrist; gain +1 die to resist a single [BIND] or compulsion effect this scene. Consumed on use.",ingredients:["Tallow","Herbs","Moonwater"],skill:"craft",dv:3,xpCost:1,tier:"minor",icon:"🧵"},"emberfang-oil":{id:"emberfang-oil",name:"🔥 Emberfang Oil",description:"An oil that burns like embers.",effect:"Apply to a weapon: next hit deals +1 Harm (fire) and may ignite flammable targets.",ingredients:["Sulphur","Olive oil","Iron filings"],skill:"craft",dv:3,xpCost:2,tier:"minor",icon:"🔥"},"ghost-touch-powder":{id:"ghost-touch-powder",name:"👻 Ghost-Touch Powder",description:"Fine powder that lets you strike spirits.",effect:"Coats a weapon: for the next scene, it can harm incorporeal creatures as if they were material.",ingredients:["Bone dust","Iron filings","Moonwater"],skill:"arcana",dv:4,xpCost:3,tier:"standard",icon:"👻"},"truesight-salve":{id:"truesight-salve",name:"👁️ Truesight Salve",description:"A paste that, when rubbed on the eyes, reveals hidden things.",effect:"For 1 hour, you can see invisible creatures and objects in Near, and you gain +1 die to detect illusions.",ingredients:["Belladonna","Moonwort","Olive oil"],skill:"arcana",dv:4,xpCost:3,tier:"standard",icon:"👁️"},"vitality-draught":{id:"vitality-draught",name:"💪 Vitality Draught",description:"A hearty brew that restores vigour.",effect:"Remove 1 Fatigue and gain +1 die on the next physical action.",ingredients:["Ginger","Honey","Alcohol"],skill:"craft",dv:3,xpCost:2,tier:"minor",icon:"💪"},"slumber-powder":{id:"slumber-powder",name:"💤 Slumber Powder",description:"A fine dust that induces sleep when inhaled.",effect:"Target in Close must test Spirit+Resolve DV 3 or fall asleep for 1 hour. One use.",ingredients:["Valerian root","Nightshade","Charcoal"],skill:"craft",dv:4,xpCost:3,tier:"standard",icon:"💤"},"herbal-infusion":{id:"herbal-infusion",name:"🌿 Herbal Infusion",description:"A concentrated extract of mixed herbs.",effect:"Used as a base for potent potions.",ingredients:["Herbs","Distilled water"],skill:"craft",dv:2,xpCost:0,tier:"minor",icon:"🌿",outputIngredient:"Herbal Infusion"},"essential-oil":{id:"essential-oil",name:"💧 Essential Oil",description:"Pure oil extracted from aromatic plants.",effect:"Used in advanced ointments and perfumes.",ingredients:["Herbs","Olive oil"],skill:"craft",dv:2,xpCost:0,tier:"minor",icon:"💧",outputIngredient:"Essential Oil"},"alchemical-base":{id:"alchemical-base",name:"🧪 Alchemical Base",description:"A neutral solvent for alchemical reactions.",effect:"Required for many advanced recipes.",ingredients:["Salt","Distilled water","Alcohol"],skill:"craft",dv:3,xpCost:1,tier:"minor",icon:"🧪",outputIngredient:"Alchemical Base"},"purified-salt":{id:"purified-salt",name:"✨ Purified Salt",description:"Salt cleansed of impurities.",effect:"Used in high-grade warding.",ingredients:["Salt","Moonwater","Charcoal"],skill:"lore",dv:3,xpCost:1,tier:"minor",icon:"✨",outputIngredient:"Purified Salt"}},z=[{id:500,title:"Salt-Line Charm",category:"magic_item",tier:"minor",cost:2,icon:"🧂",body:"A fired clay bead on twine. Once per scene, pour a pinch of salt from it to raise a [WARD] line in Near; spirits and the Hollowed suffer +1 DV to cross it."},{id:502,title:"Coat of Second Debts",category:"magic_item",tier:"major",cost:4,icon:"🧥",body:"Once per scene, as a reaction, redirect Harm meant for an ally in Close to yourself instead. Each time you do, mark 1 Obligation to a creditor you have never met and cannot name."},{id:504,title:"The Ninth Bell",category:"magic_item",tier:"prestige",cost:6,icon:"🔔",body:"A hand bell with no clapper that rings anyway. Once per session, ring it: every active Downtime Project Timer and Promise Timer touching the scene advances 1 segment."},{id:506,title:"Wanderer's Toll-Coin",category:"magic_item",tier:"epic",cost:8,icon:"🪙",body:"A coin that is always warm to the touch. Once per day, pay it to any gatekeeper, guard, or tollkeeper and you and your companions pass unmolested and unremembered."},{id:520,title:"Widow's Draught",category:"consumable",cost:1,icon:"🍵",body:"A bitter tea. Drink to remove 1 Fatigue and gain [CLEANSE] against one ongoing minor Condition rooted in grief or fear."},{id:540,title:"The Wanderer's Last Match",category:"artifact",obligation:1,icon:"🕯️",body:"A single match that relights itself every dawn. While lit, you automatically find the nearest safe way out of anywhere you're lost."},{id:507,title:"Emberfang Dagger",category:"magic_item",tier:"minor",cost:2,icon:"🗡️",body:"When drawn, glows faintly if undead are within Near. Once per scene, gain +1 die to detect hidden spirits."},{id:508,title:"Storm Lantern",category:"magic_item",tier:"major",cost:4,icon:"🏮",body:"Once per session, as an action, create a gust of wind that extinguishes all mundane flames in Near and gives +1 Position to disengage."},{id:509,title:"Cloak of the Unseen",category:"magic_item",tier:"major",cost:4,icon:"🧥",body:"+1 die to Stealth in dim light. Once per scene, reroll a failed Stealth check."},{id:510,title:"Vial of the Last Breath",category:"consumable",cost:2,icon:"🧪",body:"Heal 1 Fatigue when drunk. One use."},{id:511,title:"Pendant of the Witness",category:"magic_item",tier:"prestige",cost:6,icon:"📿",body:"Once per session, when you detect a lie, the liar suffers 1 Fatigue (no save)."},{id:512,title:"Raven's Key",category:"magic_item",tier:"epic",cost:8,icon:"🔑",body:"Once per day, as an action, unlock any mundane lock or open any door that is not magically sealed."},{id:513,title:"Widow's Match",category:"magic_item",tier:"minor",cost:2,icon:"🕯️",body:"A matchstick that never burns down. Once per scene, strike it in darkness for +1 die to Investigation when reading marks, ash, or messages left by fire or its absence."},{id:514,title:"Nine-Knot Cord",category:"magic_item",tier:"major",cost:4,icon:"🧵",body:"A braided cord tied with nine knots. Untie one knot to add +1 die to a roll after seeing the result. The cord has nine knots for the life of the item – once untied, a knot cannot be retied."},{id:515,title:"Cairn-Marker Gauntlet",category:"magic_item",tier:"prestige",cost:6,icon:"🧤",body:"An iron ring worn like a glove. Once per session, mark a location. Spend a Boon at any later time to know the exact direction and distance back to it, however far you've traveled since."},{id:516,title:"The Unspoken Ledger (Quill)",category:"magic_item",tier:"epic",cost:8,icon:"🖋️",body:"Writes in a hand that is not yours. Once per day, as an action, inscribe a single sentence of a promise on any blank surface; the person it names suffers +2 DV to act against its spirit for one scene."},{id:541,title:"The Copper Bell of Unspoken Truths",category:"artifact",obligation:2,icon:"🔔",body:"Once per session, ring the bell. The next lie told within Near range is heard as a discordant chime; you gain +1 die to expose it."},{id:542,title:"Ledger of the Debtor Saint",category:"artifact",obligation:3,icon:"📖",body:"You may record a single promise in the ledger. While the promise is unfulfilled, you gain +1 die to all rolls that directly advance it. When the promise is fulfilled, clear 1 Obligation."},{id:543,title:"The Mourner's Cloak",category:"artifact",obligation:1,icon:"🧥",body:"When you pull the hood up, you become invisible to anyone who is actively grieving (GM's judgment). The invisibility lasts until you speak or attack."},{id:544,title:"Blade of the Riven Path",category:"artifact",obligation:2,icon:"🗡️",body:"+1 die melee. Once/scene, on a kill, make an extra attack in Close. Cannot sheathe until it draws blood. Mark 1 Corruption for +1 Harm."},{id:545,title:"Hearthstone of the Lost Hearth",category:"artifact",obligation:2,icon:"🪨",body:"Once per day, as an action, you may set the stone on a threshold. For the next hour, that threshold cannot be crossed by anyone with hostile intent (Resolve DV 4 to resist)."},{id:546,title:"Mask of the Riven Path",category:"artifact",obligation:2,icon:"🎭",body:"Once per scene, as an action, you may cast a [FEAR] effect (Resolve DV 4) to anyone in Near. Targets who fail are Frightened (–1 die) for the scene. Mark 1 Corruption."},{id:547,title:"Amulet of the Unseen Gate",category:"artifact",obligation:3,icon:"📿",body:"As an action, activate a personal [WARD] field (DV 5) for 1 hour. Blocks teleportation, shadow-walking, and planar travel into the wearer's space. Degrades by 1 each time it blocks an intrusion (minimum DV 2). Once per day."},{id:548,title:"Spindle of the Unraveling Hour",category:"artifact",obligation:3,icon:"🧵",body:"Once per session, spend a full turn to unwind the scene by one exchange, undoing the immediate consequences of a single failed roll (yours or an ally's). The GM gains 2 SB to spend against your very next roll."},{id:549,title:"The Salt Prince's Toll-Box",category:"artifact",obligation:2,icon:"📦",body:"A lacquered box that always holds exactly the coin for the next toll, bribe, or fare. Once per scene, open it to produce that price – but you must surrender something of comparable worth into the box: an heirloom, a memory spoken aloud, a secret."},{id:550,title:"Ledger-Ash Locket",category:"artifact",obligation:2,icon:"📿",body:"Holds a pinch of ash from a burned contract. Once per day, burn a pinch to automatically Resist a single Rite, Working, or spell cast against you – but you must name aloud, to whoever is present, the last promise you broke."}],fe=[...Object.values(K).map((e,n)=>({id:430+n,title:e.name,category:"ingredient",body:e.description||"",tags:[e.common?"common":"rare"],cost:e.cost,icon:e.icon})),...Object.values(Y).map((e,n)=>({id:450+n,title:e.name,category:"recipe",body:e.description,effect:e.effect,ingredients:e.ingredients,skill:e.skill,dv:e.dv,xpCost:e.xpCost,tier:e.tier,icon:e.icon,outputIngredient:e.outputIngredient||null})),...z];function J(e){const n={};for(const t of e)t.category==="ingredient"&&t.title&&(n[t.title]={name:t.title,cost:t.cost!==void 0?t.cost:0,common:t.tags?.includes("common")??!0,icon:t.icon||"🧪",description:t.body||""});return Object.keys(n).length?n:K}function Z(e){const n={};for(const t of e)if(t.category==="recipe"&&t.title){const i=String(t.id)||t.title.toLowerCase().replace(/ /g,"-");n[i]={id:i,name:t.title,description:t.body||"",effect:t.effect||t.body||"",ingredients:t.ingredients||[],skill:t.skill||"craft",dv:t.dv!==void 0?t.dv:3,xpCost:t.xpCost!==void 0?t.xpCost:1,tier:t.tier||"minor",icon:t.icon||"🔧",outputIngredient:t.outputIngredient||null}}return Object.keys(n).length?n:Y}function ee(e){const n=e.filter(t=>["magic_item","consumable","artifact"].includes(t.category));return n.length?n:z}var B={minor:{label:"Minor",color:"var(--text3)"},standard:{label:"Standard",color:"var(--green)"},major:{label:"Major",color:"var(--green)"},prestige:{label:"Prestige",color:"var(--gold)"},epic:{label:"Epic",color:"var(--purple, #8e44ad)"}},j={magic_item:{label:"Magic Items",icon:"✨"},consumable:{label:"Consumables",icon:"🧪"},artifact:{label:"Artifacts",icon:"🏺"}};function T(e){return e.crafting||(e.crafting={}),e.crafting}function I(e){const n=T(e);return n.ingredients||(n.ingredients=[]),n.ingredients}function E(e){const n=T(e);return n.crafted||(n.crafted=[]),n.crafted}function R(e){const n=T(e);return n.attuned||(n.attuned=[]),n.attuned}function te(e){const n=T(e);return n.log||(n.log=[]),n.log}function L(e,n){const t=te(e);return t.unshift({...n,timestamp:Date.now()}),t.length>10&&(t.length=10),e.crafting.log=t,t}function x(e){return(e.totalXp||0)-(e.xpSpent||0)}var Ze=3;function ne(e){return T(e).forageCount||0}function ue(e){return ne(e)<3}function pe(e){const n=T(e);return n.forageCount=(n.forageCount||0)+1,n.forageCount}function me(e){T(e).forageCount=0}var et=3;function ie(e){const n=e.cost||0;return Math.max(1,Math.ceil(n/3))}function ge(e){return 1}function he(e,n){return e.some(t=>t.id===n)?!0:e.length<3}function ve(e){return e==="compromised"?{label:"Compromised",color:"var(--red)"}:e==="neglected"?{label:"Neglected",color:"var(--orange)"}:{label:"Maintained",color:"var(--green)"}}var q=["maintained","neglected","compromised"];function be(e){const n=q.indexOf(e||"maintained"),t=n===-1?0:Math.min(n+1,q.length-1);return q[t]}function oe(e){return e.category!=="artifact"}function ye(e){for(const n of e)oe(n)&&(n.paidUpkeepThisDowntime?n.condition="maintained":n.condition=be(n.condition),n.paidUpkeepThisDowntime=!1);return e}function we(e,n,t){return`
        <div class="crafting-container">
            <div class="crafting-header">
                <div class="crafting-header-left">
                    <span class="crafting-icon-lg">🔨</span>
                    <div>
                        <span class="crafting-header-title">Crafting</span>
                        <span class="crafting-header-sub">${u(e.name||"Unnamed")}</span>
                    </div>
                </div>
                <div class="crafting-header-actions">
                    <span class="crafting-xp-display">${x(e)} XP available</span>
                    <button class="btn btn-ghost btn-xs" id="craft-refresh-btn" title="Reload wiki data">🔄</button>
                </div>
            </div>
            <div class="crafting-tabs">
                <button class="crafting-tab ${t.activeTab==="crafting"?"active":""}" data-tab="crafting">🧪 Crafting</button>
                <button class="crafting-tab ${t.activeTab==="codex"?"active":""}" data-tab="codex">📖 Codex</button>
            </div>
            <div class="crafting-panel-content">
                ${n}
            </div>
        </div>
    `}function Ce(e,n,t,i,o){const a=I(e),r=E(e),d=te(e),f=Object.keys(i);let m=Object.values(t).filter(s=>!f.includes(s.id));if(o.recipeSearchQuery.trim()){const s=o.recipeSearchQuery.toLowerCase();m=m.filter(b=>b.name.toLowerCase().includes(s)||b.effect.toLowerCase().includes(s))}o.recipeSkillFilter!=="all"&&(m=m.filter(s=>s.skill===o.recipeSkillFilter)),o.recipeTierFilter!=="all"&&(m=m.filter(s=>s.tier===o.recipeTierFilter));const v={};a.forEach(s=>{v[s]=(v[s]||0)+1});const y=Object.values(i),g=ne(e),C=g>=3;return`
        <div class="crafting-toolbar">
            <button class="btn btn-secondary btn-xs" id="craft-forage-btn" ${C?"disabled":""}
                title="${C?"No forage attempts left this downtime (3/3 used)":"Forage a random common ingredient"}">
                🌿 Forage <span class="crafting-forage-count">(${g}/3)</span>
            </button>
            <div class="crafting-inline-group">
                <select id="craft-buy-select" class="crafting-select">
                    ${Object.values(n).filter(s=>!s.common).map(s=>`<option value="${u(s.name)}">${s.icon} ${u(s.name)} — ${s.cost} XP</option>`).join("")}
                </select>
                <button class="btn btn-secondary btn-xs" id="craft-buy-btn">💰 Buy</button>
            </div>
            <div class="crafting-inline-group">
                <span class="crafting-hint">Batch:</span>
                <input type="number" id="craft-batch-qty" class="crafting-input crafting-input-narrow" value="${o.batchQuantity}" min="1" max="10" />
            </div>
            ${o.craftCombineSelection.length>0?`
                <button class="btn btn-gold btn-xs" id="craft-combine-btn">⚗️ Combine (${o.craftCombineSelection.length})</button>
                <button class="btn btn-ghost btn-xs" id="craft-clear-combine-btn">✕</button>
            `:'<span class="crafting-hint">Check ingredients below to combine (up to 3)</span>'}
        </div>

        <div class="panel">
            <div class="flex-between">
                <span class="panel-title">📦 Inventory</span>
                <span class="crafting-hint">${a.length} items</span>
            </div>
            <div class="craft-inventory-grid">
                ${a.length===0?'<div class="crafting-empty-note">No ingredients. Forage or buy some.</div>':a.map((s,b)=>{const k=n[s]||{name:s,icon:"🧪",common:!0},$=o.craftCombineSelection.includes(b);return`
                        <span class="craft-ingredient-chip ${$?"selected":""}">
                            <input type="checkbox" ${$?"checked":""} data-combine-idx="${b}" />
                            <span>${k.icon} ${u(s)}</span>
                            <button type="button" class="craft-ingredient-remove" data-remove-ingredient-idx="${b}">✕</button>
                        </span>
                    `}).join("")}
            </div>
        </div>

        ${y.length>0?`
            <div class="panel">
                <div class="flex-between">
                    <span class="panel-title">⚗️ Refinement (ingredient crafting)</span>
                    <span class="crafting-hint">Turn base ingredients into advanced reagents</span>
                </div>
                <div class="craft-refinement-grid">
                    ${y.map(s=>ke(s,v,e)).join("")}
                </div>
            </div>
        `:""}

        <div class="panel">
            <div class="flex-between">
                <span class="panel-title">📜 Recipes</span>
                <div class="crafting-inline-group crafting-recipe-filters">
                    <input type="text" id="recipe-search" class="crafting-input" placeholder="Search..." value="${u(o.recipeSearchQuery)}" />
                    <select id="recipe-skill-filter" class="crafting-select">
                        <option value="all" ${o.recipeSkillFilter==="all"?"selected":""}>All Skills</option>
                        ${["craft","medicine","lore","arcana"].map(s=>`<option value="${s}" ${o.recipeSkillFilter===s?"selected":""}>${s.charAt(0).toUpperCase()+s.slice(1)}</option>`).join("")}
                    </select>
                    <select id="recipe-tier-filter" class="crafting-select">
                        <option value="all" ${o.recipeTierFilter==="all"?"selected":""}>All Tiers</option>
                        ${Object.keys(B).map(s=>`<option value="${s}" ${o.recipeTierFilter===s?"selected":""}>${B[s].label}</option>`).join("")}
                    </select>
                </div>
            </div>
            <div class="craft-recipe-grid">
                ${m.length===0?'<div class="crafting-empty-note">No recipes match.</div>':m.map(s=>xe(s,v,e,o)).join("")}
            </div>
        </div>

        <div class="panel">
            <div class="flex-between">
                <span class="panel-title">🎒 Crafted Items</span>
                <span class="crafting-hint">${r.length} on hand</span>
            </div>
            <div class="craft-crafted-list">
                ${r.length===0?'<div class="crafting-empty-note">No crafted items.</div>':r.map(s=>$e(s)).join("")}
            </div>
        </div>

        ${d.length>0?`
            <div class="crafting-log">
                <div class="crafting-log-title">📋 Recent Crafts</div>
                ${d.slice(0,5).map(s=>`
                    <div class="crafting-log-entry">
                        <span>${s.icon||"🔧"} ${u(s.name)}${s.quality?` (${s.quality})`:""}</span>
                        <span class="crafting-log-time">${new Date(s.timestamp).toLocaleTimeString()}</span>
                    </div>
                `).join("")}
            </div>
        `:""}
    `}function ke(e,n,t){const i=e.ingredients||[],o=i.filter(r=>!(n[r]>0)).length===0,a=x(t)>=e.xpCost;return`
        <div class="craft-recipe-card refinement ${o?"ready":"missing"}">
            <div class="craft-recipe-header-left">
                <span>${e.icon}</span>
                <span class="craft-recipe-name">${u(e.name)}</span>
                <span class="craft-refine-output">→ ${u(e.outputIngredient)}</span>
            </div>
            <div class="craft-recipe-desc">${u(e.description)}</div>
            <div class="craft-ingredient-list">
                ${i.map(r=>{const d=n[r]>0;return`<span class="craft-ingredient-tag ${d?"has":"missing"}">${d?"✓":"✕"} ${u(r)}</span>`}).join("")}
            </div>
            <div>
                <button class="btn btn-gold btn-xs" ${o&&a?"":"disabled"} data-refine-recipe="${u(e.id)}">
                    ⚗️ Refine (${e.xpCost} XP)
                </button>
            </div>
        </div>
    `}function xe(e,n,t,i){const o=e.ingredients||[],a=o.filter(f=>!(n[f]>0)).length===0,r=i.craftExpandedRecipe===e.id,d=x(t)>=e.xpCost*i.batchQuantity;return`
        <div class="craft-recipe-card ${a?"ready":"missing"}">
            <div class="craft-recipe-header" data-toggle-recipe="${u(e.id)}">
                <div class="craft-recipe-header-left">
                    <span>${e.icon||"🔧"}</span>
                    <span class="craft-recipe-name">${u(e.name)}</span>
                    <span class="craft-recipe-meta">${u(e.tier)} · DV ${e.dv} · ${e.xpCost} XP</span>
                    <span class="craft-recipe-status ${a?"ready":"missing"}">${a?"✓ Ready":"✕ missing"}</span>
                </div>
                <span class="craft-recipe-toggle">${r?"▾":"▸"}</span>
            </div>
            ${r?`
                <div class="craft-recipe-details">
                    <div class="craft-recipe-desc">${u(e.description||e.effect||"")}</div>
                    <div><strong>Effect:</strong> ${u(e.effect)}</div>
                    <div class="craft-ingredient-list">
                        ${o.map(f=>{const m=n[f]>0;return`<span class="craft-ingredient-tag ${m?"has":"missing"}">${m?"✓":"✕"} ${u(f)}</span>`}).join("")}
                    </div>
                    <div class="recipe-xp-note ${d?"":"insufficient"}">
                        XP available: ${x(t)}${d?"":" (not enough for batch)"}
                    </div>
                    <div>
                        <button class="btn btn-gold btn-xs" ${d?"":"disabled"} data-craft-recipe="${u(e.id)}">
                            🔨 Craft (x${i.batchQuantity})
                        </button>
                        ${a?"":'<span class="recipe-missing-note">Missing ingredients — may risk Flawed result</span>'}
                    </div>
                </div>
            `:""}
        </div>
    `}function $e(e){const n=e.uses||1;return`
        <div class="crafted-item">
            <div class="crafted-item-info">
                <span class="crafted-item-name">${u(e.name)}</span>
                <span class="crafted-item-effect">${u(e.effect)}</span>
                ${e.quality?`<span class="crafted-item-quality ${e.quality==="standard"?"standard":"flawed"}">(${e.quality})</span>`:""}
                <span class="crafted-item-uses">${n} uses</span>
            </div>
            <div class="crafted-item-actions">
                <button class="btn btn-gold btn-xs" data-use-crafted="${e.id}">Use</button>
                <button class="btn btn-ghost btn-xs crafted-item-remove" data-remove-crafted="${e.id}">✕</button>
            </div>
        </div>
    `}function Se(e,n,t){const i=R(e),o=n.filter(a=>!(a.category!==t.codexCategoryFilter||t.codexCategoryFilter==="magic_item"&&t.codexTierFilter!=="all"&&a.tier!==t.codexTierFilter));return`
        <div class="panel">
            <div class="flex-between">
                <span class="panel-title">🔗 Attuned Items</span>
                <span class="crafting-hint">${i.length}/3</span>
            </div>
            <div class="attuned-list">
                ${i.length===0?'<div class="crafting-empty-note">No items attuned. Attune up to 3 from the Codex below.</div>':i.map(a=>Ae(a)).join("")}
            </div>
        </div>

        <div class="panel">
            <div class="flex-between">
                <span class="panel-title">📖 Codex</span>
                <span class="crafting-hint">Magic items, consumables &amp; artifacts</span>
            </div>
            <div class="codex-filters">
                ${Object.keys(j).map(a=>`
                    <button class="btn btn-xs ${t.codexCategoryFilter===a?"btn-gold":"btn-secondary"}" data-codex-category="${a}">
                        ${j[a].icon} ${j[a].label}
                    </button>
                `).join("")}
                ${t.codexCategoryFilter==="magic_item"?`
                    <select id="codex-tier-filter" class="crafting-select">
                        <option value="all" ${t.codexTierFilter==="all"?"selected":""}>All Tiers</option>
                        ${Object.entries(B).map(([a,r])=>`<option value="${a}" ${t.codexTierFilter===a?"selected":""}>${r.label}</option>`).join("")}
                    </select>
                `:""}
            </div>
            <div class="codex-entry-list">
                ${o.length===0?'<div class="crafting-empty-note">Nothing in this category yet.</div>':o.map(a=>Te(a,e)).join("")}
            </div>
        </div>
    `}function Ae(e){const n=ve(e.condition),t=oe(e),i=e.condition==="compromised";return`
        <div class="attuned-item">
            <div class="attuned-item-info">
                <span class="attuned-item-name">${e.icon||"✨"} ${u(e.name)}</span>
                <span class="attuned-condition ${e.condition}">${n.label}</span>
                ${t?"":'<span class="attuned-note">(artifact)</span>'}
                ${i?'<span class="attuned-note compromised">requires quest</span>':""}
            </div>
            <div class="attuned-item-actions">
                ${t?i?`
                    <button class="btn btn-gold btn-xs" data-restore-item="${e.id}">✨ Restore</button>
                `:`
                    <span class="attuned-upkeep-cost">Upkeep: ${ie(e)} XP</span>
                    <button class="btn btn-gold btn-xs" data-pay-upkeep="${e.id}">Pay</button>
                    <button class="btn btn-secondary btn-xs" data-scene-upkeep="${e.id}">Scene</button>
                `:""}
                <button class="btn btn-ghost btn-xs attuned-retire" data-retire-item="${e.id}">Retire</button>
            </div>
        </div>
    `}function Te(e,n){const t=R(n),i=t.some(r=>r.id===e.id),o=e.tier?B[e.tier]||B.minor:null,a=e.category==="artifact"?`<span class="codex-cost obligation">Obligation ${e.obligation??"?"}</span>`:`<span class="codex-cost">${e.cost??"?"} XP${o?` · ${o.label}`:""}</span>`;return`
        <div class="codex-entry" style="--codex-entry-accent: ${o?o.color:"var(--gold)"};">
            <div class="codex-entry-header">
                <span class="codex-entry-title">${e.icon||"✨"} ${u(e.title)}</span>
                ${a}
            </div>
            <div class="codex-entry-body">${u(e.body||"")}</div>
            ${e.category==="magic_item"?`
                <div>
                    <button class="btn btn-gold btn-xs" data-toggle-attune="${e.id}" ${!i&&t.length>=3?'disabled title="Already attuned to 3 items"':""}>
                        ${i?"✕ Break Attunement":"🔗 Attune"}
                    </button>
                </div>
            `:""}
        </div>
    `}function Ie(e){return`
        <div class="crafting-container crafting-empty-state">
            <div class="crafting-empty-icon">🔨</div>
            <h2 class="crafting-empty-title">Select a Character</h2>
            <p class="crafting-empty-text">Pick a character to forage ingredients, work recipes, and browse the Codex.</p>
            <div class="crafting-empty-actions">
                ${e.length>0?`
                    <select id="crafting-char-select" class="crafting-select crafting-char-select">
                        <option value="">— Choose a character —</option>
                        ${e.map(n=>`<option value="${u(n.id)}">${u(n.name||"Unnamed")}</option>`).join("")}
                    </select>
                `:'<p class="crafting-empty-text">No characters yet — create one on the Characters tab first.</p>'}
                <button class="btn btn-gold" id="craft-go-to-vtt-btn">🎯 Go to VTT</button>
            </div>
        </div>
    `}function Re({recipe:e,quantity:n,pool:t,dv:i,result:o,outcome:a,outcomeClass:r,totalXpCost:d,boons:f,sbCount:m,consumed:v,missing:y,itemsCreated:g}){return`
        <div class="craft-result-toast">
            <div class="craft-result-title">🔧 Crafting: ${u(e.name)} (×${n})</div>
            <div class="craft-result-desc">${u(e.description)}</div>
            <div class="craft-result-meta">Pool: ${t}d · DV: ${i}</div>
            <div class="craft-result-roll">Roll: ${o.dice.join(", ")}</div>
            <div class="craft-result-successes">Rolled: <strong>${o.successes}</strong> successes</div>
            <div class="craft-result-outcome ${r}">${a}</div>
            ${d>0?`<div class="craft-result-cost">Cost: ${d} XP</div>`:""}
            ${f>0?`<div class="craft-result-boons">⭐ +${f} Boon${f>1?"s":""}</div>`:""}
            ${m>0?`<div class="craft-result-sb">📖 GM gains ${m} SB</div>`:""}
            ${v.length>0?`<div class="craft-result-consumed">Consumed: ${v.join(", ")}</div>`:""}
            ${y.length>0?`<div class="craft-result-missing">Missing ingredients (crafted anyway): ${y.join(", ")}</div>`:""}
            ${g.length>0?`<div class="craft-result-created">Created ${g.length} item${g.length>1?"s":""}</div>`:""}
            <button class="btn btn-secondary btn-xs craft-result-close" type="button">Close</button>
        </div>
    `}var w=null,V=null,l={craftCombineSelection:[],craftExpandedRecipe:null,codexTierFilter:"all",codexCategoryFilter:"magic_item",activeTab:"crafting",recipeSearchQuery:"",recipeSkillFilter:"all",recipeTierFilter:"all",batchQuantity:1},H={};function Fe(e){V!==e.id&&(l.craftCombineSelection=[],l.craftExpandedRecipe=null,l.batchQuantity=1,l.recipeSearchQuery="",l.recipeSkillFilter="all",l.recipeTierFilter="all",V=e.id)}function De(e={}){const{silent:n=!1}=e,t=P.getSelectedCharacterId();if(!t)return n||c("Select a character first.","error"),null;const i=de(t);return i||(n||c("Character not found.","error"),null)}function h(e){const n=P.getSelectedCharacterId();return n?!!G(n,e):!1}async function p(){w&&await ae(w)}async function ae(e){if(w=e,!w)return;const n=De({silent:!0});if(!n){w.innerHTML=Ie(D().characters||[]),Ee();return}Fe(n),await Q();const t=D().wikiEntries||[],i=J(t),o=Z(t),a=ee(t);H={};for(const[d,f]of Object.entries(o))f.outputIngredient&&(H[d]=f);const r=l.activeTab==="crafting"?Ce(n,i,o,H,l):Se(n,a,l);w.innerHTML=we(n,r,l),Xe(n)}function Ee(){const e=document.getElementById("crafting-char-select");e&&e.addEventListener("change",()=>{const t=e.value;t&&(P.updateCharacters(D().characters||[]),P.selectCharacter(t),p())});const n=document.getElementById("craft-go-to-vtt-btn");n&&n.addEventListener("click",()=>{window.location.hash="vtt"})}function Me(e,n){if(!ue(e))return c("No forage attempts left this downtime (3/3 used). Wait for the next GM Downtime.","warning");const t=Object.values(n).filter(a=>a.common);if(t.length===0)return c("No common ingredients defined.","error");const i=t[Math.floor(Math.random()*t.length)];I(e).push(i.name);const o=pe(e);h({crafting:e.crafting}),c(`🌿 Foraged ${i.icon} ${i.name} (${o}/3 this downtime)`,"success"),p()}function Be(e,n){const t=document.getElementById("craft-buy-select");if(!t||!t.value)return c("Choose a rare ingredient to buy first.","error");const i=n[t.value];if(!i)return c("Ingredient not found.","error");if(x(e)<i.cost)return c(`Not enough XP. Need ${i.cost}, have ${x(e)}.`,"error");e.xpSpent=(e.xpSpent||0)+i.cost,I(e).push(i.name),h({xpSpent:e.xpSpent,crafting:e.crafting}),c(`💰 Purchased ${i.icon} ${i.name} for ${i.cost} XP`,"success"),p()}function Le(e,n){const t=I(e);if(n<0||n>=t.length)return;const[i]=t.splice(n,1);e.crafting.ingredients=t,l.craftCombineSelection=l.craftCombineSelection.filter(o=>o!==n).map(o=>o>n?o-1:o),h({crafting:e.crafting}),c(`Removed ${i}.`,"info"),p()}function Oe(e){const n=l.craftCombineSelection.indexOf(e);if(n===-1){if(l.craftCombineSelection.length>=3)return c("You can combine up to 3 ingredients at once.","warning");l.craftCombineSelection.push(e)}else l.craftCombineSelection.splice(n,1);p()}function Pe(e,n){if(l.craftCombineSelection.length===0)return c("Check at least one ingredient below to combine.","warning");const t=I(e),i=[...new Set(l.craftCombineSelection)].filter(r=>r>=0&&r<t.length).sort((r,d)=>d-r),o=i.map(r=>t[r]).reverse();for(const r of i)t.splice(r,1);e.crafting.ingredients=t,l.craftCombineSelection=[];let a=null;for(const r of Object.values(n)){const d=r.ingredients||[];if(o.length>0&&o.every(f=>d.some(m=>m.toLowerCase()===f.toLowerCase()))){a=r;break}}if(a)E(e).push({id:_("crafted_"),name:a.name,effect:a.effect,quality:"standard",uses:a.tier==="standard"?2:1,recipe:a.id,icon:a.icon||"🔧",createdAt:Date.now()}),L(e,{name:a.name,quality:"standard",icon:a.icon}),h({crafting:e.crafting}),c(`⚗️ Successfully crafted ${a.icon} ${a.name}!`,"success");else{const r=["A bubbly green liquid that smells of mint; drink it to restore 1 Fatigue.","A grey powder that sparkles; it can be thrown to create a flash of light (distract enemies).","A sticky tar that hardens on contact; can be used to patch a leak or jam a lock.","A sweet syrup that induces vivid dreams; take it to gain +1 die on a future Wits roll.","A bitter tonic that purges the system; removes one Poisoned condition (if any)."],d=r[Math.floor(Math.random()*r.length)];E(e).push({id:_("crafted_"),name:"🧪 Unknown Concoction",effect:d,quality:"flawed",uses:1,recipe:null,icon:"🧪",createdAt:Date.now()}),L(e,{name:"Unknown Concoction",quality:"flawed",icon:"🧪"}),h({crafting:e.crafting}),c(`⚗️ You created an unknown concoction: ${d}`,"info")}p()}function Ne(e,n,t,i=1){const o=n[t];if(!o)return c("Recipe not found.","error");const a=o.ingredients||[],r=I(e),d=a.filter(F=>!r.some(A=>A.toLowerCase()===F.toLowerCase())),f=o.xpCost*i;if(x(e)<f)return c(`Not enough XP. Need ${f}, have ${x(e)}.`,"error");const m=e.skills?.[o.skill]||0,v=(e[o.skill==="medicine"||o.skill==="craft"?"wits":"spirit"]||1)+m,y=o.dv,g=ce(v,y);let C=!1,s="",b="failure",k=0,$=0;g.successes>=y?(C=!0,s="✅ Success",b="success"):g.successes>0?(s="⚠️ Partial",b="partial",k=1):(s="❌ Failure",$=g.storyBeats||1,k=2);const S={};let M=0;(C||s==="⚠️ Partial")&&(e.xpSpent=(e.xpSpent||0)+f,M=f,S.xpSpent=e.xpSpent),k>0&&(e.boons=Math.min(5,(e.boons||0)+k),S.boons=e.boons);const U=[];for(const F of a)for(let A=0;A<i;A++){const N=r.findIndex(se=>se.toLowerCase()===F.toLowerCase());N!==-1&&(U.push(r[N]),r.splice(N,1))}e.crafting.ingredients=r,S.crafting=e.crafting;const re=E(e),O=[];if(C||s==="⚠️ Partial"){for(let F=0;F<i;F++){const A={id:_("crafted_"),name:o.name,effect:o.effect,quality:C?"standard":"flawed",uses:o.tier==="standard"?2:1,recipe:o.id,icon:o.icon||"🔧",createdAt:Date.now()};re.push(A),O.push(A)}S.crafting=e.crafting,O.length>0&&L(e,{name:o.name,quality:O[0].quality,icon:o.icon})}else L(e,{name:`Failed: ${o.name}`,quality:"failure",icon:"💥"});h(S),l.craftExpandedRecipe=null,Ge(Re({recipe:o,quantity:i,pool:v,dv:y,result:g,outcome:s,outcomeClass:b,totalXpCost:M,boons:k,sbCount:$,consumed:U,missing:d,itemsCreated:O})),p()}function je(e,n){const t=E(e),i=t.find(o=>o.id===n);if(!i)return c("Item not found.","error");c(`🧪 Used "${i.name}": ${i.effect||"The item is used."}`,"success"),i.uses=(i.uses||1)-1,i.uses<=0&&(e.crafting.crafted=t.filter(o=>o.id!==n)),h({crafting:e.crafting}),p()}function qe(e,n){e.crafting.crafted=E(e).filter(t=>t.id!==n),h({crafting:e.crafting}),c("Item removed.","info"),p()}function He(e,n,t){const i=n[t];if(!i||!i.outputIngredient)return c("Not a refinement recipe.","error");const o=i.ingredients||[],a=I(e),r=o.filter(d=>!a.some(f=>f.toLowerCase()===d.toLowerCase()));if(r.length>0)return c(`Missing ingredients: ${r.join(", ")}`,"error");if(x(e)<i.xpCost)return c(`Not enough XP. Need ${i.xpCost}.`,"error");for(const d of o){const f=a.findIndex(m=>m.toLowerCase()===d.toLowerCase());f!==-1&&a.splice(f,1)}a.push(i.outputIngredient),e.xpSpent=(e.xpSpent||0)+i.xpCost,L(e,{name:i.outputIngredient,quality:"refined",icon:i.icon}),h({xpSpent:e.xpSpent,crafting:e.crafting}),c(`⚗️ Refined ${i.outputIngredient} from ${o.join(", ")}.`,"success"),p()}function _e(e,n,t){const i=n.find(r=>r.id===t);if(!i)return c("Item not found in the Codex.","error");const o=R(e),a=o.findIndex(r=>r.id===t);if(a!==-1)o.splice(a,1),c(`Broke attunement with ${i.title}.`,"info");else{if(!he(o,t))return c("Already attuned to 3 items — break one first.","warning");o.push({id:i.id,name:i.title,cost:i.cost,tier:i.tier,icon:i.icon,category:i.category,condition:"maintained",paidUpkeepThisDowntime:!1,attunedAt:Date.now()}),c(`🔗 Attuned to ${i.title}.`,"success")}h({crafting:e.crafting}),p()}function X(e,n,t){const i=R(e).find(o=>o.id===n);if(!i)return c("Item not found.","error");if(i.condition==="compromised")return c(`${i.name} is Compromised — upkeep won't fix it. It requires a quest to restore.`,"warning");if(t==="efficient"){const o=ie(i);if(x(e)<o)return c(`Not enough XP for upkeep. Need ${o}.`,"error");e.xpSpent=(e.xpSpent||0)+o,i.condition="maintained",i.paidUpkeepThisDowntime=!0,h({xpSpent:e.xpSpent,crafting:e.crafting}),c(`💰 Paid ${o} XP upkeep for ${i.name}.`,"success")}else e.xpSpent=(e.xpSpent||0)+ge(i),i.condition="maintained",i.paidUpkeepThisDowntime=!0,h({xpSpent:e.xpSpent,crafting:e.crafting}),c(`🕯️ Spent a downtime scene maintaining ${i.name}.`,"success");p()}function Ue(e,n){const t=R(e).find(i=>i.id===n);if(!t)return c("Item not found.","error");if(t.condition!=="compromised")return c(`${t.name} isn't Compromised.`,"info");t.condition="maintained",t.paidUpkeepThisDowntime=!0,h({crafting:e.crafting}),c(`✨ ${t.name} restored after a quest to fix it.`,"success"),p()}function We(e,n){const t=R(e),i=t.findIndex(r=>r.id===n);if(i===-1)return;const[o]=t.splice(i,1),a=Math.floor((o.cost||0)/2);a>0&&(e.xpSpent=Math.max(0,(e.xpSpent||0)-a)),h({xpSpent:e.xpSpent,crafting:e.crafting}),c(`Retired ${o.name}${a>0?` — regained ${a} XP`:""}.`,"info"),p()}function Ve(){const e=D().characters||[];let n=!1;for(const t of e){const i=R(t),o=i.map(a=>a.condition);i.length>0&&ye(i),i.some((a,r)=>a.condition!==o[r])&&(n=!0),me(t),G(t.id,{crafting:t.crafting})}n?c("🕯️ Downtime passed — some attuned items decayed (unpaid upkeep). Forage attempts have reset.","warning"):c("🕯️ Downtime passed — forage attempts have reset.","info"),p()}typeof document<"u"&&document.addEventListener("downtime-tick",Ve);function Xe(e){if(!w)return;const n=document.getElementById("craft-refresh-btn");n&&n.addEventListener("click",async()=>{c("🔄 Reloading crafting data…","info"),await Q(!0),await p(),c("✅ Crafting refreshed.","success")}),w.addEventListener("click",t=>{const i=t.target.closest(".crafting-tab");i&&(l.activeTab=i.dataset.tab,p())}),w.addEventListener("input",t=>{const i=t.target.closest("#recipe-search");if(i)return l.recipeSearchQuery=i.value,p();const o=t.target.closest("#craft-batch-qty");if(o){let a=parseInt(o.value,10);return(isNaN(a)||a<1)&&(a=1),a>10&&(a=10),l.batchQuantity=a,p()}}),w.addEventListener("change",t=>{const i=t.target.closest("#codex-tier-filter");if(i)return l.codexTierFilter=i.value,p();const o=t.target.closest("#recipe-skill-filter");if(o)return l.recipeSkillFilter=o.value,p();const a=t.target.closest("#recipe-tier-filter");if(a)return l.recipeTierFilter=a.value,p();const r=t.target.closest("[data-combine-idx]");if(r)return Oe(parseInt(r.dataset.combineIdx,10))}),w.addEventListener("click",async t=>{const i=D().wikiEntries||[],o=J(i),a=Z(i),r=ee(i);if(t.target.closest("#craft-forage-btn"))return Me(e,o);if(t.target.closest("#craft-buy-btn"))return Be(e,o);if(t.target.closest("#craft-combine-btn"))return Pe(e,a);if(t.target.closest("#craft-clear-combine-btn"))return l.craftCombineSelection=[],p();const d=t.target.closest("[data-remove-ingredient-idx]");if(d)return Le(e,parseInt(d.dataset.removeIngredientIdx,10));const f=t.target.closest("[data-toggle-recipe]");if(f){const M=f.dataset.toggleRecipe;return l.craftExpandedRecipe=l.craftExpandedRecipe===M?null:M,p()}const m=t.target.closest("[data-craft-recipe]");if(m)return Ne(e,a,m.dataset.craftRecipe,l.batchQuantity||1);const v=t.target.closest("[data-refine-recipe]");if(v)return He(e,a,v.dataset.refineRecipe);const y=t.target.closest("[data-use-crafted]");if(y)return je(e,y.dataset.useCrafted);const g=t.target.closest("[data-remove-crafted]");if(g)return qe(e,g.dataset.removeCrafted);const C=t.target.closest("[data-codex-category]");if(C)return l.codexCategoryFilter=C.dataset.codexCategory,p();const s=t.target.closest("[data-toggle-attune]");if(s)return _e(e,r,le(s.dataset.toggleAttune,0));const b=t.target.closest("[data-pay-upkeep]");if(b)return X(e,b.dataset.payUpkeep,"efficient");const k=t.target.closest("[data-scene-upkeep]");if(k)return X(e,k.dataset.sceneUpkeep,"intensive");const $=t.target.closest("[data-retire-item]");if($)return We(e,$.dataset.retireItem);const S=t.target.closest("[data-restore-item]");if(S)return Ue(e,S.dataset.restoreItem)})}function Ge(e){const n=document.querySelector(".custom-toast-modal");n&&n.remove();const t=document.createElement("div");t.className="custom-toast-modal";const i=document.createElement("div");i.className="custom-toast-modal-inner",i.innerHTML=e,t.appendChild(i),document.body.appendChild(t);const o=i.querySelector(".craft-result-close");o&&o.addEventListener("click",()=>t.remove()),setTimeout(()=>{t.parentNode&&t.remove()},1e4)}function Qe(){w=null}var tt={render:ae,destroy:Qe};export{et as ATTUNEMENT_LIMIT,q as DECAY_ORDER,Ze as FORAGE_LIMIT_PER_DOWNTIME,be as advanceDecay,ye as applyDowntimeTick,he as canAttune,ue as canForage,tt as default,Qe as destroy,ne as getForageCount,ge as intensiveUpkeepCostFor,oe as itemRequiresUpkeep,pe as recordForageAttempt,ae as render,me as resetForageCount,ie as upkeepCostFor};
