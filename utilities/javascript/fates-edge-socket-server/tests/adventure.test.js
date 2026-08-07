const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const adventure = require('../server/adventure.js');

function makeRoom() {
    return { data: {}, lastActivity: null };
}

const CONTENT = {
    title: 'Test Adventure',
    tier: 1,
    acts: [
        {
            id: 'act1',
            title: 'Act One',
            scenes: [
                { id: 's1', title: 'Scene One' },
                { id: 's2', title: 'Scene Two' },
            ],
        },
        {
            id: 'act2',
            title: 'Act Two',
            scenes: [
                { id: 's3', title: 'Scene Three' },
            ],
        },
    ],
};

describe('adventure.js status transitions', () => {
    test('a fresh room starts in "planned" status with no module', () => {
        const room = makeRoom();
        const state = adventure.getPublicState(room);
        assert.equal(state.status, 'planned');
        assert.equal(state.moduleId, null);
    });

    test('loadAdventureContent() transitions planned -> active', () => {
        const room = makeRoom();
        const state = adventure.loadAdventureContent(room, CONTENT);
        assert.equal(state.status, 'active');
        assert.equal(state.moduleId, 'custom');
        assert.equal(state.currentActIndex, 0);
        assert.equal(state.currentSceneIndex, 0);
    });

    test('advanceScene() walks scenes/acts in order and completes on the final scene', () => {
        const room = makeRoom();
        adventure.loadAdventureContent(room, CONTENT);

        let state = adventure.advanceScene(room); // s1 -> s2
        assert.equal(state.status, 'active');
        assert.equal(state.currentActIndex, 0);
        assert.equal(state.currentSceneIndex, 1);

        state = adventure.advanceScene(room); // s2 -> act2/s3
        assert.equal(state.status, 'active');
        assert.equal(state.currentActIndex, 1);
        assert.equal(state.currentSceneIndex, 0);

        state = adventure.advanceScene(room); // s3 was the last scene of the last act
        assert.equal(state.status, 'completed');
        assert.ok(state.updatedAt);
    });

    test('resetAdventure() returns status to "planned" with the module (moduleId) still intact', () => {
        const room = makeRoom();
        adventure.loadAdventureContent(room, CONTENT);
        adventure.advanceScene(room);
        adventure.advanceScene(room);
        adventure.advanceScene(room); // now completed

        const state = adventure.resetAdventure(room);
        assert.equal(state.status, 'planned');
        assert.equal(state.moduleId, 'custom'); // module stays loaded, per file's own docstring
        assert.equal(state.currentActIndex, 0);
        assert.equal(state.currentSceneIndex, 0);
        // every scene's completed flag is cleared
        for (const act of state.tableOfContents) {
            for (const scene of act.scenes) {
                assert.equal(scene.completed, false);
            }
        }
    });

    test('advanceScene() with an explicit target jumps directly and marks the left scene completed', () => {
        const room = makeRoom();
        adventure.loadAdventureContent(room, CONTENT);
        const state = adventure.advanceScene(room, { actIndex: 1, sceneIndex: 0 });
        assert.equal(state.currentActIndex, 1);
        assert.equal(state.currentSceneIndex, 0);
        assert.equal(state.tableOfContents[0].scenes[0].completed, true); // s1 was left
    });

    test('advanceScene() throws when no module is loaded', () => {
        const room = makeRoom();
        assert.throws(() => adventure.advanceScene(room), /No adventure module is loaded/);
    });
});

describe('adventure.js encounter objective type', () => {
    test('an ad-hoc encounter with type: "lockpick" round-trips through startEncounter into the active-encounter snapshot', () => {
        const room = makeRoom();
        adventure.loadAdventureContent(room, CONTENT);
        const state = adventure.startEncounter(room, 'door', {
            name: 'Stuck Door',
            dv: 3,
            position: 'risky',
            outcomes: { clean: 'Open', partial: 'Open, but noisy', miss: 'Jammed' },
            type: 'lockpick',
        });
        assert.equal(state.activeEncounter.type, 'lockpick');
        assert.equal(state.activeEncounter.name, 'Stuck Door');
    });

    test('an ad-hoc encounter started with no type field defaults to "combat" and behaves as before', () => {
        const room = makeRoom();
        adventure.loadAdventureContent(room, CONTENT);
        const state = adventure.startEncounter(room, 'goblin', {
            name: 'Goblin Ambush',
            dv: 3,
            position: 'controlled',
            outcomes: { clean: 'Win', partial: 'Bloodied', miss: 'Retreat' },
        });
        assert.equal(state.activeEncounter.type, 'combat');
        assert.equal(state.activeEncounter.name, 'Goblin Ambush');

        // resolving also carries the defaulted type through lastResolution
        const resolved = adventure.resolveEncounter(room, { outcome: 'clean' });
        assert.equal(resolved.lastResolution.type, 'combat');
        assert.equal(resolved.lastResolution.encounter, 'Goblin Ambush');
    });
});
