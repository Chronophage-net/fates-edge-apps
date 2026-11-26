import { describe, it, assert, assertEqual } from '../runner.js';
import { applyLiveState, getLiveAdventure, renderLiveAdventure } from '../../js/features/adventure-manager/live-adventure.js';

// The room server's public adventure view (server/adventure.js getPublicState).
const serverState = {
    moduleId: 'custom_1', title: 'The Salt Road', status: 'active', tier: 'I', dynamicGrowth: true,
    currentActIndex: 0, currentSceneIndex: 1,
    currentAct: { title: 'Act One' },
    currentScene: { title: 'The Toll Gate', description: 'Rain on the gate.', timers: [{ name: 'Alarm', segments: 4, current: 2 }],
        encounters: [{ name: 'Gate wardens', dv: 3, position: 'Controlled' }] },
    activeEncounter: null,
    campaignTimers: [{ name: 'Winter', segments: 6, current: 1 }],
    tableOfContents: [{ title: 'Act One', scenes: [{ title: 'The Ferry', completed: true }, { title: 'The Toll Gate', completed: false }] }],
    knowledge: [{ id: 'k1', subject: 'The toll', revealed: false, text: 'Something is off about the toll.' }],
    log: [{ author: 'AI_GM', message: 'Alarm: 2/4' }],
};

describe('Room adventure (live) state', () => {
    it('takes server adventure broadcasts and ignores other payloads', () => {
        assert(applyLiveState(serverState));
        assertEqual(getLiveAdventure().title, 'The Salt Road');
        assertEqual(applyLiveState({ clients: [] }), false, 'a non-adventure payload is ignored');
        assertEqual(getLiveAdventure().title, 'The Salt Road');
    });
    it('hands the screen back to the local library when the server has no adventure', () => {
        applyLiveState(serverState);
        applyLiveState({ moduleId: null, status: 'planned' });
        assertEqual(getLiveAdventure(), null);
    });
});

describe('Room adventure (live) view', () => {
    it('shows the scene, clocks, outline and log to everyone', () => {
        applyLiveState(serverState);
        const html = renderLiveAdventure({ canRun: false });
        for (const text of ['The Salt Road', 'The Toll Gate', 'Alarm', 'Winter', 'The Ferry', 'Alarm: 2/4', 'AI GM is growing it']) {
            assert(html.includes(text), `missing ${text}`);
        }
        assert(html.includes('Read-only'));
        assert(!/data-live-(advance|tick|encounter|reveal)/.test(html), 'players get no controls');
    });
    it('gives a GM controls that drive the server', () => {
        applyLiveState(serverState);
        const html = renderLiveAdventure({ canRun: true });
        for (const attr of ['data-live-advance', 'data-live-tick="scene"', 'data-live-tick="campaign"', 'data-live-encounter="0"', 'data-live-reveal="k1"']) {
            assert(html.includes(attr), `missing ${attr}`);
        }
    });
    it('escapes server text', () => {
        applyLiveState({ ...serverState, title: '<img src=x onerror=alert(1)>' });
        assert(!renderLiveAdventure({ canRun: false }).includes('<img'), 'title must be escaped');
    });
});
