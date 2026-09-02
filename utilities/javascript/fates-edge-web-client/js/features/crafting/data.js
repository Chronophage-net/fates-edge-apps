/**
 * Crafting feature — static game data (ingredients, recipes, Codex
 * fallbacks) and /data/wiki.json loading/parsing.
 *
 * Split out of index.js so the (large) hand-authored fallback data
 * tables don't crowd out the rendering/orchestration logic, and so this
 * module can be imported independently for data-only concerns.
 */

import { getState, saveState } from '@core/state.js';

// ============================================================
// WIKI DATA LOADING (ingredients, recipes, and the Codex)
// ============================================================

export async function ensureWikiLoaded(force = false) {
    const state = getState();
    if (state.wikiEntries && !force) return;
    try {
        const response = await fetch('/data/wiki.json');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        state.wikiEntries = data.data || [];
        state.wikiData = data;
        saveState();
    } catch (err) {
        console.warn('[Crafting] Failed to load wiki.json, using fallback data.', err);
        state.wikiEntries = [...FALLBACK_WIKI_ENTRIES];
        state.wikiData = { data: state.wikiEntries };
        saveState();
    }
}

// ─── Fallback data (used only if /data/wiki.json can't be fetched) ────

export const FALLBACK_INGREDIENTS = {
    // Herbs (common)
    'Herbs': { name: 'Herbs', cost: 0, common: true, icon: '🌿', description: 'A bundle of common medicinal herbs.' },
    'Clean cloth': { name: 'Clean cloth', cost: 0, common: true, icon: '🧻', description: 'Linen or cotton cloth, sterile.' },
    'Chamomile': { name: 'Chamomile', cost: 0, common: true, icon: '🌼', description: 'Dried chamomile flowers; calming.' },
    'Lavender': { name: 'Lavender', cost: 0, common: true, icon: '💜', description: 'Fragrant purple flowers; soothing.' },
    'Mint': { name: 'Mint', cost: 0, common: true, icon: '🌱', description: 'Fresh or dried mint leaves.' },
    'Rosemary': { name: 'Rosemary', cost: 0, common: true, icon: '🌿', description: 'Pungent herb; memory and purification.' },
    'Sage': { name: 'Sage', cost: 0, common: true, icon: '🌿', description: 'Common culinary and ritual herb.' },
    'Thyme': { name: 'Thyme', cost: 0, common: true, icon: '🌿', description: 'Fragrant, antiseptic.' },
    // Rare herbs
    'Moonwort': { name: 'Moonwort', cost: 1, common: false, icon: '🌙', description: 'Silver-veined herb that grows only under full moon.' },
    'Nightshade': { name: 'Nightshade', cost: 1, common: false, icon: '☠️', description: 'A dark, poisonous plant; used sparingly.' },
    'Valerian root': { name: 'Valerian root', cost: 0, common: true, icon: '🌰', description: 'Root that induces sleep and calm.' },
    'Belladonna': { name: 'Belladonna', cost: 1, common: false, icon: '🍇', description: 'Deadly nightshade; potent and dangerous.' },
    // Minerals (common)
    'Salt': { name: 'Salt', cost: 0, common: true, icon: '🧂', description: 'Coarse sea salt; purifying.' },
    'Iron filings': { name: 'Iron filings', cost: 0, common: true, icon: '⚙️', description: 'Fine iron shavings; magnetic and warding.' },
    'Charcoal': { name: 'Charcoal', cost: 0, common: true, icon: '🪵', description: 'Burnt wood; absorbent.' },
    'Sulphur': { name: 'Sulphur', cost: 0, common: true, icon: '🟡', description: 'Yellow powder; flammable.' },
    'Saltpetre': { name: 'Saltpetre', cost: 0, common: true, icon: '🧪', description: 'Potassium nitrate; explosive.' },
    'Clay': { name: 'Clay', cost: 0, common: true, icon: '🏺', description: 'Mouldable earth; for tablets and vessels.' },
    // Rare minerals
    'Quicksilver': { name: 'Quicksilver', cost: 1, common: false, icon: '💧', description: 'Liquid mercury; volatile and conductive.' },
    'Orpiment': { name: 'Orpiment', cost: 1, common: false, icon: '🟠', description: 'Bright yellow mineral; toxic and transformative.' },
    'Lodestone': { name: 'Lodestone', cost: 1, common: false, icon: '🧲', description: 'Magnetic stone; attracts and guides.' },
    // Animal products
    'Blood': { name: 'Blood', cost: 0, common: true, icon: '🩸', description: 'Fresh blood (any source).' },
    'Bone dust': { name: 'Bone dust', cost: 0, common: true, icon: '🦴', description: 'Ground bone; structural.' },
    'Tallow': { name: 'Tallow', cost: 0, common: true, icon: '🕯️', description: 'Rendered animal fat; for candles and ointments.' },
    'Feathers': { name: 'Feathers', cost: 0, common: true, icon: '🪶', description: 'Bird feathers; light and insulating.' },
    // Rare animal parts
    'Dragon’s blood': { name: 'Dragon’s blood', cost: 3, common: false, icon: '🐉', description: 'A drop from a true dragon; legendary.' },
    'Phoenix feather': { name: 'Phoenix feather', cost: 3, common: false, icon: '🦅', description: 'A feather of a phoenix; renewal.' },
    // Alchemical (common)
    'Distilled water': { name: 'Distilled water', cost: 0, common: true, icon: '💧', description: 'Pure water, free of impurities.' },
    'Alcohol': { name: 'Alcohol', cost: 0, common: true, icon: '🍷', description: 'High-proof spirit; solvent.' },
    'Vinegar': { name: 'Vinegar', cost: 0, common: true, icon: '🍶', description: 'Acidic liquid; preservative.' },
    'Olive oil': { name: 'Olive oil', cost: 0, common: true, icon: '🫒', description: 'Pure oil; base for ointments.' },
    // Rare alchemical
    'Aqua Regia': { name: 'Aqua Regia', cost: 2, common: false, icon: '🧪', description: 'Royal water; dissolves metals.' },
    'Essence of Shadow': { name: 'Essence of Shadow', cost: 2, common: false, icon: '🌑', description: 'Congealed darkness; elusive.' },
    // Magical (common)
    'Moonwater': { name: 'Moonwater', cost: 0, common: true, icon: '🌙', description: 'Water blessed by moonlight; enchanted.' },
    'Blessed ash': { name: 'Blessed ash', cost: 0, common: true, icon: '🔥', description: 'Ashes from a sacred fire.' },
    'Incense': { name: 'Incense', cost: 0, common: true, icon: '🪔', description: 'Fragrant resin; for rituals.' },
    'Honey': { name: 'Honey', cost: 0, common: true, icon: '🍯', description: 'Sweet, preserving, and healing.' },
    // Rare magical
    'Sunbeam': { name: 'Sunbeam', cost: 2, common: false, icon: '☀️', description: 'Captured sunlight; dispels darkness.' },
    'Essence of Life': { name: 'Essence of Life', cost: 2, common: false, icon: '💚', description: 'Vital energy; rare and potent.' },
    'Rare herb': { name: 'Rare herb', cost: 1, common: false, icon: '🌱', description: 'A generic rare herb (for fallback).' },
    'Pure water': { name: 'Pure water', cost: 0, common: true, icon: '💧', description: 'Clean water (fallback).' },
    // Additional common ingredients for recipes
    'Garlic': { name: 'Garlic', cost: 0, common: true, icon: '🧄', description: 'Pungent bulb; wards evil.' },
    'Ginger': { name: 'Ginger', cost: 0, common: true, icon: '🫚', description: 'Spicy root; warming.' },
    'Cinnamon': { name: 'Cinnamon', cost: 0, common: true, icon: '🪵', description: 'Sweet bark; for potions.' },
    'Clove': { name: 'Clove', cost: 0, common: true, icon: '🌼', description: 'Aromatic spice; numbing.' },
    'Myrrh': { name: 'Myrrh', cost: 0, common: true, icon: '🪔', description: 'Resin; used in rites.' },
    'Frankincense': { name: 'Frankincense', cost: 0, common: true, icon: '🪔', description: 'Resin; for sacred smoke.' },
};

export const FALLBACK_RECIPES = {
    // Existing
    'healing-poultice': { id: 'healing-poultice', name: '🩹 Healing Poultice', description: 'A balm of herbs and salves that speeds recovery.', effect: 'Remove 1 Fatigue when applied during a short rest.', ingredients: ['Herbs', 'Clean cloth'], skill: 'craft', dv: 2, xpCost: 1, tier: 'minor', icon: '🩹' },
    'antidote': { id: 'antidote', name: '🧪 Antidote', description: 'A bitter draught that neutralises common poisons.', effect: 'Remove one Poisoned Condition.', ingredients: ['Rare herb', 'Distilled water', 'Charcoal'], skill: 'craft', dv: 3, xpCost: 2, tier: 'minor', icon: '🧪' },
    'sleep-draught': { id: 'sleep-draught', name: '💤 Sleep Draught', description: 'A sweet syrup that induces deep, dreamless sleep.', effect: 'Target tests Spirit+Resolve (DV 3) or falls asleep for 1 hour.', ingredients: ['Valerian root', 'Honey', 'Moonwater'], skill: 'craft', dv: 3, xpCost: 1, tier: 'minor', icon: '💤' },
    'ward-salt': { id: 'ward-salt', name: '🧂 Ward Salt', description: 'Salt blessed with protective herbs and iron filings.', effect: 'Line wards against spirits and undead (Spirit+Resolve DV 4 to cross).', ingredients: ['Salt', 'Blessed ash', 'Iron filings'], skill: 'lore', dv: 3, xpCost: 2, tier: 'minor', icon: '🧂' },
    'truth-serum': { id: 'truth-serum', name: '🔮 Truth Serum', description: 'A clear liquid that loosens the tongue.', effect: 'Target tests Spirit+Resolve (DV 4) or speaks only truth for one exchange.', ingredients: ['Nightshade', 'Pure water', 'Blood'], skill: 'craft', dv: 4, xpCost: 3, tier: 'standard', icon: '🔮' },
    'moon-tea': { id: 'moon-tea', name: '🌙 Moon Tea', description: 'A calming infusion that sharpens dreams and intuition.', effect: '+1 die on next Wits or Spirit roll within 1 hour.', ingredients: ['Chamomile', 'Moonwort', 'Honey'], skill: 'craft', dv: 2, xpCost: 1, tier: 'minor', icon: '🌙' },
    'fire-powder': { id: 'fire-powder', name: '🔥 Fire Powder', description: 'A volatile powder that ignites on contact with air.', effect: 'Creates a small fire (Harm 2, Area) in Close range. One use.', ingredients: ['Sulphur', 'Charcoal', 'Saltpetre'], skill: 'craft', dv: 4, xpCost: 3, tier: 'standard', icon: '🔥' },
    'blessed-oil': { id: 'blessed-oil', name: '🕯️ Blessed Oil', description: 'Oil consecrated to a Patron or Threshold.', effect: 'Anoints a weapon or threshold; counts as [WARD] or [BLESSED] for one scene.', ingredients: ['Olive oil', 'Incense'], skill: 'lore', dv: 3, xpCost: 2, tier: 'standard', icon: '🕯️' },
    // New recipes
    'stimulant-draught': { id: 'stimulant-draught', name: '⚡ Stimulant Draught', description: 'A sharp, invigorating potion.', effect: '+1 die to all physical actions for the next scene.', ingredients: ['Mint', 'Ginger', 'Distilled water'], skill: 'craft', dv: 3, xpCost: 2, tier: 'minor', icon: '⚡' },
    'clarity-tincture': { id: 'clarity-tincture', name: '🧠 Clarity Tincture', description: 'Clears the mind and sharpens wit.', effect: '+1 die to all mental actions for the next scene.', ingredients: ['Rosemary', 'Chamomile', 'Moonwater'], skill: 'craft', dv: 3, xpCost: 2, tier: 'minor', icon: '🧠' },
    'invisibility-powder': { id: 'invisibility-powder', name: '👻 Invisibility Powder', description: 'A handful of shimmering dust.', effect: 'When thrown, you and allies in Close become invisible for 1 exchange (or until you attack).', ingredients: ['Moonwater', 'Iron filings', 'Salt'], skill: 'arcana', dv: 4, xpCost: 3, tier: 'standard', icon: '👻' },
    'frost-oil': { id: 'frost-oil', name: '❄️ Frost Oil', description: 'A slick, cold oil that freezes on contact.', effect: 'Apply to a weapon: next hit deals +1 Harm (cold) and target moves at half speed for 1 turn.', ingredients: ['Moonwater', 'Salt', 'Olive oil'], skill: 'craft', dv: 3, xpCost: 2, tier: 'minor', icon: '❄️' },
    'speed-syrup': { id: 'speed-syrup', name: '💨 Speed Syrup', description: 'A thick, sweet elixir.', effect: '+1 Move for the next scene.', ingredients: ['Valerian root', 'Honey', 'Moonwater'], skill: 'craft', dv: 3, xpCost: 2, tier: 'minor', icon: '💨' },
    'healing-draught': { id: 'healing-draught', name: '❤️‍🩹 Healing Draught', description: 'A powerful restorative.', effect: 'Restore 2 Fatigue when consumed during a short rest.', ingredients: ['Herbs', 'Honey', 'Distilled water'], skill: 'craft', dv: 3, xpCost: 2, tier: 'standard', icon: '❤️‍🩹' },
    'restorative-salve': { id: 'restorative-salve', name: '🛡️ Restorative Salve', description: 'Thick, green ointment.', effect: 'Remove one ongoing minor Condition (e.g., Poisoned, Diseased) when applied.', ingredients: ['Herbs', 'Clean cloth', 'Olive oil'], skill: 'craft', dv: 3, xpCost: 2, tier: 'standard', icon: '🛡️' },
    'warding-incense': { id: 'warding-incense', name: '🪔 Warding Incense', description: 'Burning incense that creates a protective circle.', effect: 'For 1 hour, any spirit or undead trying to cross the circle must test Spirit+Resolve DV 4.', ingredients: ['Incense', 'Blessed ash', 'Salt'], skill: 'lore', dv: 3, xpCost: 2, tier: 'minor', icon: '🪔' },
    'bottled-squall': { id: 'bottled-squall', name: '🌪️ Bottled Squall', description: 'A corked jar holding a captive wind.', effect: 'Uncork to create a burst of wind (Area, Near). Extinguishes flames and grants allies +1 Position to disengage.', ingredients: ['Moonwater', 'Feathers', 'Salt'], skill: 'arcana', dv: 4, xpCost: 3, tier: 'standard', icon: '🌪️' },
    'chime-glass-vial': { id: 'chime-glass-vial', name: '🔔 Chime-Glass Vial', description: 'A fragile vial that sings when broken.', effect: 'Shatter to reveal [WARD] boundaries and thin spots in the Weave within Near for one exchange.', ingredients: ['Quicksilver', 'Clay', 'Moonwater'], skill: 'arcana', dv: 4, xpCost: 3, tier: 'standard', icon: '🔔' },
    'debtors-chalk': { id: 'debtors-chalk', name: '✏️ Debtor\'s Chalk', description: 'A stick of chalk that remembers promises.', effect: 'Draw a line; anyone who crosses it while owing you a promise suffers –1 die on their next roll unless they acknowledge the debt aloud.', ingredients: ['Salt', 'Blessed ash', 'Charcoal'], skill: 'lore', dv: 3, xpCost: 2, tier: 'minor', icon: '✏️' },
    'cairn-dust': { id: 'cairn-dust', name: '🪦 Cairn Dust', description: 'Dust from a sacred cairn.', effect: 'Toss over a corpse: for the rest of the scene, that body cannot be reanimated, possessed, or read for necromantic sending.', ingredients: ['Bone dust', 'Salt', 'Blessed ash'], skill: 'lore', dv: 3, xpCost: 2, tier: 'minor', icon: '🪦' },
    'nine-knot-twine': { id: 'nine-knot-twine', name: '🧵 Nine-Knot Twine', description: 'A braided cord with nine knots.', effect: 'Tie around a wrist; gain +1 die to resist a single [BIND] or compulsion effect this scene. Consumed on use.', ingredients: ['Tallow', 'Herbs', 'Moonwater'], skill: 'craft', dv: 3, xpCost: 1, tier: 'minor', icon: '🧵' },
    'emberfang-oil': { id: 'emberfang-oil', name: '🔥 Emberfang Oil', description: 'An oil that burns like embers.', effect: 'Apply to a weapon: next hit deals +1 Harm (fire) and may ignite flammable targets.', ingredients: ['Sulphur', 'Olive oil', 'Iron filings'], skill: 'craft', dv: 3, xpCost: 2, tier: 'minor', icon: '🔥' },
    'ghost-touch-powder': { id: 'ghost-touch-powder', name: '👻 Ghost-Touch Powder', description: 'Fine powder that lets you strike spirits.', effect: 'Coats a weapon: for the next scene, it can harm incorporeal creatures as if they were material.', ingredients: ['Bone dust', 'Iron filings', 'Moonwater'], skill: 'arcana', dv: 4, xpCost: 3, tier: 'standard', icon: '👻' },
    'truesight-salve': { id: 'truesight-salve', name: '👁️ Truesight Salve', description: 'A paste that, when rubbed on the eyes, reveals hidden things.', effect: 'For 1 hour, you can see invisible creatures and objects in Near, and you gain +1 die to detect illusions.', ingredients: ['Belladonna', 'Moonwort', 'Olive oil'], skill: 'arcana', dv: 4, xpCost: 3, tier: 'standard', icon: '👁️' },
    'vitality-draught': { id: 'vitality-draught', name: '💪 Vitality Draught', description: 'A hearty brew that restores vigour.', effect: 'Remove 1 Fatigue and gain +1 die on the next physical action.', ingredients: ['Ginger', 'Honey', 'Alcohol'], skill: 'craft', dv: 3, xpCost: 2, tier: 'minor', icon: '💪' },
    'slumber-powder': { id: 'slumber-powder', name: '💤 Slumber Powder', description: 'A fine dust that induces sleep when inhaled.', effect: 'Target in Close must test Spirit+Resolve DV 3 or fall asleep for 1 hour. One use.', ingredients: ['Valerian root', 'Nightshade', 'Charcoal'], skill: 'craft', dv: 4, xpCost: 3, tier: 'standard', icon: '💤' },
    // Refinement recipes (output an ingredient)
    'herbal-infusion': { id: 'herbal-infusion', name: '🌿 Herbal Infusion', description: 'A concentrated extract of mixed herbs.', effect: 'Used as a base for potent potions.', ingredients: ['Herbs', 'Distilled water'], skill: 'craft', dv: 2, xpCost: 0, tier: 'minor', icon: '🌿', outputIngredient: 'Herbal Infusion' },
    'essential-oil': { id: 'essential-oil', name: '💧 Essential Oil', description: 'Pure oil extracted from aromatic plants.', effect: 'Used in advanced ointments and perfumes.', ingredients: ['Herbs', 'Olive oil'], skill: 'craft', dv: 2, xpCost: 0, tier: 'minor', icon: '💧', outputIngredient: 'Essential Oil' },
    'alchemical-base': { id: 'alchemical-base', name: '🧪 Alchemical Base', description: 'A neutral solvent for alchemical reactions.', effect: 'Required for many advanced recipes.', ingredients: ['Salt', 'Distilled water', 'Alcohol'], skill: 'craft', dv: 3, xpCost: 1, tier: 'minor', icon: '🧪', outputIngredient: 'Alchemical Base' },
    'purified-salt': { id: 'purified-salt', name: '✨ Purified Salt', description: 'Salt cleansed of impurities.', effect: 'Used in high-grade warding.', ingredients: ['Salt', 'Moonwater', 'Charcoal'], skill: 'lore', dv: 3, xpCost: 1, tier: 'minor', icon: '✨', outputIngredient: 'Purified Salt' },
};

export const FALLBACK_CODEX = [
    // Existing
    { id: 500, title: 'Salt-Line Charm', category: 'magic_item', tier: 'minor', cost: 2, icon: '🧂', body: 'A fired clay bead on twine. Once per scene, pour a pinch of salt from it to raise a [WARD] line in Near; spirits and the Hollowed suffer +1 DV to cross it.' },
    { id: 502, title: 'Coat of Second Debts', category: 'magic_item', tier: 'major', cost: 4, icon: '🧥', body: 'Once per scene, as a reaction, redirect Harm meant for an ally in Close to yourself instead. Each time you do, mark 1 Obligation to a creditor you have never met and cannot name.' },
    { id: 504, title: 'The Ninth Bell', category: 'magic_item', tier: 'prestige', cost: 6, icon: '🔔', body: "A hand bell with no clapper that rings anyway. Once per session, ring it: every active Downtime Project Timer and Promise Timer touching the scene advances 1 segment." },
    { id: 506, title: "Wanderer's Toll-Coin", category: 'magic_item', tier: 'epic', cost: 8, icon: '🪙', body: 'A coin that is always warm to the touch. Once per day, pay it to any gatekeeper, guard, or tollkeeper and you and your companions pass unmolested and unremembered.' },
    { id: 520, title: "Widow's Draught", category: 'consumable', cost: 1, icon: '🍵', body: 'A bitter tea. Drink to remove 1 Fatigue and gain [CLEANSE] against one ongoing minor Condition rooted in grief or fear.' },
    { id: 540, title: "The Wanderer's Last Match", category: 'artifact', obligation: 1, icon: '🕯️', body: "A single match that relights itself every dawn. While lit, you automatically find the nearest safe way out of anywhere you're lost." },
    // New magic items from rulebook
    { id: 507, title: 'Emberfang Dagger', category: 'magic_item', tier: 'minor', cost: 2, icon: '🗡️', body: 'When drawn, glows faintly if undead are within Near. Once per scene, gain +1 die to detect hidden spirits.' },
    { id: 508, title: 'Storm Lantern', category: 'magic_item', tier: 'major', cost: 4, icon: '🏮', body: 'Once per session, as an action, create a gust of wind that extinguishes all mundane flames in Near and gives +1 Position to disengage.' },
    { id: 509, title: 'Cloak of the Unseen', category: 'magic_item', tier: 'major', cost: 4, icon: '🧥', body: '+1 die to Stealth in dim light. Once per scene, reroll a failed Stealth check.' },
    { id: 510, title: 'Vial of the Last Breath', category: 'consumable', cost: 2, icon: '🧪', body: 'Heal 1 Fatigue when drunk. One use.' },
    { id: 511, title: 'Pendant of the Witness', category: 'magic_item', tier: 'prestige', cost: 6, icon: '📿', body: 'Once per session, when you detect a lie, the liar suffers 1 Fatigue (no save).' },
    { id: 512, title: "Raven's Key", category: 'magic_item', tier: 'epic', cost: 8, icon: '🔑', body: 'Once per day, as an action, unlock any mundane lock or open any door that is not magically sealed.' },
    { id: 513, title: 'Widow\'s Match', category: 'magic_item', tier: 'minor', cost: 2, icon: '🕯️', body: 'A matchstick that never burns down. Once per scene, strike it in darkness for +1 die to Investigation when reading marks, ash, or messages left by fire or its absence.' },
    { id: 514, title: 'Nine-Knot Cord', category: 'magic_item', tier: 'major', cost: 4, icon: '🧵', body: 'A braided cord tied with nine knots. Untie one knot to add +1 die to a roll after seeing the result. The cord has nine knots for the life of the item – once untied, a knot cannot be retied.' },
    { id: 515, title: 'Cairn-Marker Gauntlet', category: 'magic_item', tier: 'prestige', cost: 6, icon: '🧤', body: 'An iron ring worn like a glove. Once per session, mark a location. Spend a Boon at any later time to know the exact direction and distance back to it, however far you\'ve traveled since.' },
    { id: 516, title: 'The Unspoken Ledger (Quill)', category: 'magic_item', tier: 'epic', cost: 8, icon: '🖋️', body: 'Writes in a hand that is not yours. Once per day, as an action, inscribe a single sentence of a promise on any blank surface; the person it names suffers +2 DV to act against its spirit for one scene.' },
    // Additional artifacts
    { id: 541, title: 'The Copper Bell of Unspoken Truths', category: 'artifact', obligation: 2, icon: '🔔', body: 'Once per session, ring the bell. The next lie told within Near range is heard as a discordant chime; you gain +1 die to expose it.' },
    { id: 542, title: 'Ledger of the Debtor Saint', category: 'artifact', obligation: 3, icon: '📖', body: 'You may record a single promise in the ledger. While the promise is unfulfilled, you gain +1 die to all rolls that directly advance it. When the promise is fulfilled, clear 1 Obligation.' },
    { id: 543, title: 'The Mourner\'s Cloak', category: 'artifact', obligation: 1, icon: '🧥', body: 'When you pull the hood up, you become invisible to anyone who is actively grieving (GM\'s judgment). The invisibility lasts until you speak or attack.' },
    { id: 544, title: 'Blade of the Riven Path', category: 'artifact', obligation: 2, icon: '🗡️', body: '+1 die melee. Once/scene, on a kill, make an extra attack in Close. Cannot sheathe until it draws blood. Mark 1 Corruption for +1 Harm.' },
    { id: 545, title: 'Hearthstone of the Lost Hearth', category: 'artifact', obligation: 2, icon: '🪨', body: 'Once per day, as an action, you may set the stone on a threshold. For the next hour, that threshold cannot be crossed by anyone with hostile intent (Resolve DV 4 to resist).' },
    { id: 546, title: 'Mask of the Riven Path', category: 'artifact', obligation: 2, icon: '🎭', body: 'Once per scene, as an action, you may cast a [FEAR] effect (Resolve DV 4) to anyone in Near. Targets who fail are Frightened (–1 die) for the scene. Mark 1 Corruption.' },
    { id: 547, title: 'Amulet of the Unseen Gate', category: 'artifact', obligation: 3, icon: '📿', body: 'As an action, activate a personal [WARD] field (DV 5) for 1 hour. Blocks teleportation, shadow-walking, and planar travel into the wearer\'s space. Degrades by 1 each time it blocks an intrusion (minimum DV 2). Once per day.' },
    { id: 548, title: 'Spindle of the Unraveling Hour', category: 'artifact', obligation: 3, icon: '🧵', body: 'Once per session, spend a full turn to unwind the scene by one exchange, undoing the immediate consequences of a single failed roll (yours or an ally\'s). The GM gains 2 SB to spend against your very next roll.' },
    { id: 549, title: 'The Salt Prince\'s Toll-Box', category: 'artifact', obligation: 2, icon: '📦', body: 'A lacquered box that always holds exactly the coin for the next toll, bribe, or fare. Once per scene, open it to produce that price – but you must surrender something of comparable worth into the box: an heirloom, a memory spoken aloud, a secret.' },
    { id: 550, title: 'Ledger-Ash Locket', category: 'artifact', obligation: 2, icon: '📿', body: 'Holds a pinch of ash from a burned contract. Once per day, burn a pinch to automatically Resist a single Rite, Working, or spell cast against you – but you must name aloud, to whoever is present, the last promise you broke.' },
];

// Build fallback wiki entries
export const FALLBACK_WIKI_ENTRIES = [
    ...Object.values(FALLBACK_INGREDIENTS).map((i, idx) => ({ id: 430 + idx, title: i.name, category: 'ingredient', body: i.description || '', tags: [i.common ? 'common' : 'rare'], cost: i.cost, icon: i.icon })),
    ...Object.values(FALLBACK_RECIPES).map((r, idx) => ({ id: 450 + idx, title: r.name, category: 'recipe', body: r.description, effect: r.effect, ingredients: r.ingredients, skill: r.skill, dv: r.dv, xpCost: r.xpCost, tier: r.tier, icon: r.icon, outputIngredient: r.outputIngredient || null })),
    ...FALLBACK_CODEX
];

// ============================================================
// DATA PARSING
// ============================================================

export function parseIngredientsFromWiki(entries) {
    const map = {};
    for (const entry of entries) {
        if (entry.category === 'ingredient' && entry.title) {
            map[entry.title] = {
                name: entry.title,
                cost: entry.cost !== undefined ? entry.cost : 0,
                common: entry.tags?.includes('common') ?? true,
                icon: entry.icon || '🧪',
                description: entry.body || ''
            };
        }
    }
    return Object.keys(map).length ? map : FALLBACK_INGREDIENTS;
}

export function parseRecipesFromWiki(entries) {
    const recipes = {};
    for (const entry of entries) {
        if (entry.category === 'recipe' && entry.title) {
            const id = String(entry.id) || entry.title.toLowerCase().replace(/ /g, '-');
            recipes[id] = {
                id, name: entry.title, description: entry.body || '', effect: entry.effect || entry.body || '',
                ingredients: entry.ingredients || [], skill: entry.skill || 'craft',
                dv: entry.dv !== undefined ? entry.dv : 3, xpCost: entry.xpCost !== undefined ? entry.xpCost : 1,
                tier: entry.tier || 'minor', icon: entry.icon || '🔧',
                outputIngredient: entry.outputIngredient || null   // if set, produces an ingredient
            };
        }
    }
    return Object.keys(recipes).length ? recipes : FALLBACK_RECIPES;
}

export function parseCodexFromWiki(entries) {
    const codex = entries.filter(e => ['magic_item', 'consumable', 'artifact'].includes(e.category));
    return codex.length ? codex : FALLBACK_CODEX;
}

export const TIER_META = {
    minor: { label: 'Minor', color: 'var(--text3)' },
    standard: { label: 'Standard', color: 'var(--green)' },
    major: { label: 'Major', color: 'var(--green)' },
    prestige: { label: 'Prestige', color: 'var(--gold)' },
    epic: { label: 'Epic', color: 'var(--purple, #8e44ad)' }
};

export const CATEGORY_META = {
    magic_item: { label: 'Magic Items', icon: '✨' },
    consumable: { label: 'Consumables', icon: '🧪' },
    artifact: { label: 'Artifacts', icon: '🏺' }
};
