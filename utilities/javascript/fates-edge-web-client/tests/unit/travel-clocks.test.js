import { describe, it, assert } from '../runner.js';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = readFileSync(join(ROOT, 'js', 'features', 'travel-planner', 'index.js'), 'utf8');

/**
 * Clocks are legal at 4, 6, 8 and 10. Nothing else is a clock.
 *
 * The worked itineraries shipped 18 legs with `clockHint: 7`, which is what
 * you get by averaging the source books' "Clock: 6-8 depending on unrest" --
 * a range that was never meant to be averaged. The book means 6 normally and
 * 8 when the leg is contested, so the data carries the base and the table
 * makes the call.
 *
 * A source guard rather than a behavioural test: the itineraries are a module
 * -level literal with no export, and the value that matters is the one an
 * author types.
 */
describe('travel planner: every clock is a legal clock', () => {
    const LEGAL = new Set([4, 6, 8, 10]);

    it('no leg carries a clock size the rules do not have', () => {
        const found = [...SRC.matchAll(/clockHint:\s*(\d+)/g)].map(m => Number(m[1]));
        assert(found.length > 0, 'expected to find clockHint values to check');
        const illegal = [...new Set(found.filter(n => !LEGAL.has(n)))];
        assert(illegal.length === 0,
            `illegal clock sizes in worked itineraries: ${illegal.join(', ')} — legal sizes are 4, 6, 8, 10`);
    });

    it('the UI presents the hint as a base, not a fixed size', () => {
        // A GM reading "suggested clock 6" will use 6. Reading "base clock 6
        // (8 if contested)" gets the book's actual reading, which is the
        // information the averaging destroyed.
        assert(/base clock \$\{leg\.clockHint\}/.test(SRC),
            'the leg summary should present clockHint as a base with an escalation');
    });
});
