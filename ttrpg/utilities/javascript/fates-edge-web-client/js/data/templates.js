/**
 * Character build templates for the Builder feature
 */
export const BUILD_TEMPLATES = {
    striker: {
        name: 'Striker',
        body: 3,
        wits: 2,
        spirit: 1,
        presence: 1,
        skills: { melee: 2, athletics: 1, endurance: 1 },
        talents: [
            { name: 'Weapon Mastery (longsword)', cost: 5 },
            { name: 'Disciplined Body', cost: 3 },
            { name: 'Second Wind', cost: 2 }
        ],
        assets: [
            { name: 'Longsword (Medium)', cost: 8 },
            { name: 'Light armor', cost: 4 }
        ],
        equipment: [{ name: 'Longsword', cost: 8 }],
        bonds: [],
        comps: []
    },
    rogue: {
        name: 'Rogue',
        body: 2,
        wits: 3,
        spirit: 1,
        presence: 1,
        skills: { stealth: 2, deception: 2, melee: 1 },
        talents: [
            { name: 'Light Fingers', cost: 2 },
            { name: 'The Unlocked Window', cost: 2 },
            { name: 'Backstab', cost: 6 }
        ],
        assets: [{ name: 'Lockpicks', cost: 2 }],
        equipment: [{ name: 'Throwing knives', cost: 4 }],
        bonds: [],
        comps: []
    },
    face: {
        name: 'Face',
        body: 1,
        wits: 2,
        spirit: 1,
        presence: 3,
        skills: { sway: 2, command: 2, insight: 1 },
        talents: [
            { name: 'Silver Tongue', cost: 2 },
            { name: 'Command Presence', cost: 4 },
            { name: 'Network Weaver', cost: 4 }
        ],
        assets: [],
        equipment: [],
        bonds: [],
        comps: []
    },
    runekeeper: {
        name: 'Runekeeper',
        body: 1,
        wits: 2,
        spirit: 3,
        presence: 1,
        skills: { lore: 2, arcana: 1, insight: 1 },
        talents: [
            { name: 'Familiar (Thiasos)', cost: 2 },
            { name: 'Codex', cost: 4 }
        ],
        assets: [],
        equipment: [],
        bonds: [],
        comps: []
    },
    runicWarrior: {
        name: 'Runic Warrior',
        body: 3,
        wits: 1,
        spirit: 2,
        presence: 1,
        skills: { melee: 2, command: 1, athletics: 1 },
        talents: [
            { name: 'Flesh Codex', cost: 4 },
            { name: 'Living Thiasos', cost: 3 },
            { name: 'Oath-Bound', cost: 4 },
            { name: 'Scarred Resilience', cost: 3 }
        ],
        assets: [
            { name: 'Longsword', cost: 8 },
            { name: 'Light armor', cost: 4 }
        ],
        equipment: [{ name: 'Longsword', cost: 8 }],
        bonds: [],
        comps: []
    },
    invoker: {
        name: 'Invoker',
        body: 1,
        wits: 3,
        spirit: 2,
        presence: 1,
        skills: { lore: 2, arcana: 1, deception: 1 },
        talents: [
            { name: "Patron's Symbol", cost: 4 },
            { name: 'Ritual Mastery', cost: 4 }
        ],
        assets: [],
        equipment: [],
        bonds: [],
        comps: []
    },
    threadweaver: {
        name: 'Threadweaver',
        body: 1,
        wits: 3,
        spirit: 2,
        presence: 1,
        skills: { arcana: 2, lore: 1, investigation: 1 },
        talents: [
            { name: 'Spellcraft', cost: 6 },
            { name: 'Practiced Caster', cost: 2 },
            { name: 'Controlled Burn', cost: 4 }
        ],
        assets: [],
        equipment: [],
        bonds: [],
        comps: []
    },
    cantor: {
        name: 'Cantor',
        body: 1,
        wits: 2,
        spirit: 2,
        presence: 3,
        skills: { performance: 2, lore: 2, sway: 1 },
        talents: [
            { name: "Cantor's Path", cost: 8 },
            { name: 'Steady Voice', cost: 2 }
        ],
        assets: [],
        equipment: [],
        bonds: [],
        comps: []
    },
    witch: {
        name: 'Witch',
        body: 1,
        wits: 3,
        spirit: 2,
        presence: 1,
        skills: { lore: 2, insight: 1, medicine: 1 },
        talents: [
            { name: 'Steady Hand', cost: 2 },
            { name: 'Salt Line', cost: 2 },
            { name: 'Hearth-Sense', cost: 2 }
        ],
        assets: [],
        equipment: [],
        bonds: [],
        comps: []
    },
    psion: {
        name: 'Psion',
        body: 1,
        wits: 2,
        spirit: 3,
        presence: 1,
        skills: { arcana: 2, lore: 1 },
        talents: [
            { name: 'Mental Fortress', cost: 8 },
            { name: 'Psychic Reservoir', cost: 4 }
        ],
        assets: [],
        equipment: [],
        bonds: [],
        comps: []
    },
    monk: {
        name: 'Monk',
        body: 3,
        wits: 3,
        spirit: 1,
        presence: 1,
        skills: { melee: 2, athletics: 1, stealth: 1 },
        talents: [
            { name: 'Unarmed Combatant', cost: 4 },
            { name: 'Disciplined Body', cost: 3 },
            { name: 'Still Point', cost: 2 },
            { name: "Monk's Breath", cost: 2 }
        ],
        assets: [],
        equipment: [],
        bonds: [],
        comps: []
    },
    summoner: {
        name: 'Summoner',
        body: 1,
        wits: 2,
        spirit: 3,
        presence: 1,
        skills: { lore: 2, arcana: 1 },
        talents: [
            { name: 'Pact-Whisperer', cost: 2 },
            { name: 'Lesser Pactwright', cost: 2 }
        ],
        assets: [],
        equipment: [],
        bonds: [],
        comps: []
    },
    ranger: {
        name: 'Ranger',
        body: 2,
        wits: 3,
        spirit: 1,
        presence: 1,
        skills: { ranged: 2, survival: 2, stealth: 1 },
        talents: [
            { name: 'Weapon Mastery (bow)', cost: 5 },
            { name: 'Keen Senses', cost: 2 }
        ],
        assets: [
            { name: 'Longbow', cost: 6 },
            { name: 'Leather armor', cost: 4 }
        ],
        equipment: [{ name: 'Longbow', cost: 6 }],
        bonds: [],
        comps: []
    },
    commander: {
        name: 'Commander',
        body: 2,
        wits: 2,
        spirit: 1,
        presence: 3,
        skills: { command: 2, tactics: 2, sway: 1 },
        talents: [
            { name: 'Command Presence', cost: 4 },
            { name: 'Inspire', cost: 3 }
        ],
        assets: [],
        equipment: [],
        bonds: [],
        comps: []
    },
    forger: {
        name: 'Forger',
        body: 2,
        wits: 3,
        spirit: 1,
        presence: 1,
        skills: { craft: 2, investigation: 2, deception: 1 },
        talents: [
            { name: 'Master Craft', cost: 2 },
            { name: "The Forger's Eye", cost: 4 }
        ],
        assets: [{ name: 'Workshop (Minor)', cost: 4 }],
        equipment: [],
        bonds: [],
        comps: []
    },
    healer: {
        name: 'Healer',
        body: 1,
        wits: 2,
        spirit: 3,
        presence: 1,
        skills: { medicine: 2, lore: 2, sway: 1 },
        talents: [
            { name: 'Field Dressing', cost: 2 },
            { name: 'Triage', cost: 4 }
        ],
        assets: [{ name: "Healer's kit", cost: 2 }],
        equipment: [],
        bonds: [],
        comps: []
    }
};
