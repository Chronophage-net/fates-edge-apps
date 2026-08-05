import { describe, it, assert } from '../runner.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_CLIENT_ROOT = path.join(__dirname, '..', '..');

/**
 * Regression + wiring coverage for the "Jump to the Action" welcome-overlay
 * flow (js/features/home/index.js).
 *
 * Before this change, quickStart() fetched `/data/pre-gens.json` and tried
 * to load the `lantern_at_dusk` adventure, but data/pre-gens.json did not
 * exist anywhere in the repo -- the pre-gen step silently failed every
 * time (caught, non-fatal, logged a console.warn) and the welcome overlay
 * never actually handed the player a character. These tests pin down both
 * the data file's existence/shape and the source wiring of the new flow so
 * neither regresses silently again.
 */
describe('Jump to the Action: pre-gen data', () => {
    const pregensPath = path.join(WEB_CLIENT_ROOT, 'data', 'pre-gens.json');

    it('data/pre-gens.json exists and is valid JSON (regression: this file never existed before)', () => {
        assert(fs.existsSync(pregensPath), 'data/pre-gens.json should exist');
        const raw = fs.readFileSync(pregensPath, 'utf8');
        const parsed = JSON.parse(raw);
        assert(Array.isArray(parsed) && parsed.length > 0, 'pre-gens.json should be a non-empty array');
    });

    it('every pregen has the fields quickStart()/the character roster depend on', () => {
        const chars = JSON.parse(fs.readFileSync(pregensPath, 'utf8'));
        for (const c of chars) {
            assert(typeof c.id === 'string' && c.id.length > 0, `pregen missing id: ${JSON.stringify(c).slice(0, 80)}`);
            assert(typeof c.name === 'string' && c.name.length > 0, `pregen missing name: ${c.id}`);
            assert(c.skills && typeof c.skills === 'object', `pregen ${c.id} missing skills object`);
            assert(Array.isArray(c.talents), `pregen ${c.id} missing talents array`);
            assert(['I', 'II', 'III', 'IV', 'V'].includes(c.tier), `pregen ${c.id} has an invalid tier: ${c.tier}`);
        }
    });

    it('exactly one pregen is flagged as the "Jump to the Action" default character', () => {
        const chars = JSON.parse(fs.readFileSync(pregensPath, 'utf8'));
        const featured = chars.filter(c => c.recommendedFor === 'Jump to the Action');
        assert(featured.length === 1, `expected exactly 1 featured pregen, found ${featured.length}`);
    });

    it('the bundled starter adventure (lantern_at_dusk) that quickStart() loads actually exists', () => {
        const adventurePath = path.join(WEB_CLIENT_ROOT, 'data', 'adventures', 'lantern_at_dusk.json');
        assert(fs.existsSync(adventurePath), 'data/adventures/lantern_at_dusk.json should exist');
        const adventure = JSON.parse(fs.readFileSync(adventurePath, 'utf8'));
        assert(typeof adventure.title === 'string' && adventure.title.length > 0);
        assert(Array.isArray(adventure.acts) && adventure.acts.length > 0, 'starter adventure should have at least one act');
    });
});

describe('Jump to the Action: welcome overlay wiring (source guard)', () => {
    const homeSrc = fs.readFileSync(path.join(WEB_CLIENT_ROOT, 'js', 'features', 'home', 'index.js'), 'utf8');

    it('the welcome overlay offers a "Jump to the Action" button', () => {
        assert(/Jump to the Action/.test(homeSrc));
        assert(/data-action="quick-start"/.test(homeSrc));
    });

    it('quickStart() fetches pre-gens.json from the path the data file actually lives at', () => {
        assert(/PREGENS_URL\s*=\s*'\/data\/pre-gens\.json'/.test(homeSrc));
        assert(/fetch\(PREGENS_URL\)/.test(homeSrc));
    });

    it('quickStart() singles out one featured character for the confirmation pane', () => {
        assert(/recommendedFor === 'Jump to the Action'/.test(homeSrc));
    });

    it('the post-launch confirmation pane links to the Essentials quickstart doc', () => {
        assert(/ESSENTIALS_DOC_URL\s*=\s*'\/data\/docs\/resources\/Fates_-_Edge_-_-Essentials\.html'/.test(homeSrc));
        assert(/href="\$\{ESSENTIALS_DOC_URL\}"/.test(homeSrc));
    });

    it('has a confirmation pane with an explicit "Enter the Game" continue action', () => {
        assert(/data-action="enter-game"/.test(homeSrc));
        assert(/Enter the Game/.test(homeSrc));
    });

    it('guards against double-firing quick-start (delegated container handler + the overlay\'s own direct listener both match [data-action="quick-start"])', () => {
        assert(/quickStartInFlight/.test(homeSrc), 'expected an in-flight guard flag');
        assert(/if \(quickStartInFlight\) return;/.test(homeSrc));
        // The delegated container-level handler must not unconditionally
        // re-run quick-start when the overlay (which handles its own click)
        // is present.
        assert(/if \(!document\.getElementById\('welcome-overlay'\)\)/.test(homeSrc));
    });

    it('quickStart() returns a result object instead of navigating directly, so the overlay can show its own confirmation step', () => {
        assert(/return \{ character: featuredCharacter, adventure \};/.test(homeSrc));
    });
});
