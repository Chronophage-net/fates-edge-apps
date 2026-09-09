import { describe, it, assertEqual } from '../runner.js';
import { choosePlayerMode } from '../../js/core/player-mode.js';
describe('Player view preference', () => {
    it('defaults phones to player view and larger screens to the toolkit', () => {
        assertEqual(choosePlayerMode('', null, true), true);
        assertEqual(choosePlayerMode('', null, false), false);
    });
    it('respects an explicit full view on phones and a player link on desktop', () => {
        assertEqual(choosePlayerMode('?view=full', 'player', true), false);
        assertEqual(choosePlayerMode('?view=player', 'full', false), true);
        assertEqual(choosePlayerMode('?view=unknown', 'full', true), false);
    });
});
