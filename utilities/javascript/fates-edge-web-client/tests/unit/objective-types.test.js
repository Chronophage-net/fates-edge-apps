import { describe, it, assert, assertEqual, assertTrue, assertFalse } from '../runner.js';
import {
    OBJECTIVE_TYPES,
    DEFAULT_OBJECTIVE_TYPE,
    getObjectiveType,
    resolveObjectiveType,
    isCombatType,
    isCustomType,
    listObjectiveTypes
} from '../../js/core/objective-types.js';

// NOTE: this only tests the plain-data registry/helpers in objective-types.js.
// combat.js's rendering is DOM-driven (innerHTML strings appended to
// document.body via a module-level `modal` var) and this repo's test harness
// has no DOM, so — matching the documented limitation from the earlier test
// passes in this suite — we don't attempt to exercise renderTracker() here.

describe('objective-types: registry shape', () => {

    it('DEFAULT_OBJECTIVE_TYPE is combat, for back-compat with old saved data', () => {
        assertEqual(DEFAULT_OBJECTIVE_TYPE, 'combat');
        assert(Object.prototype.hasOwnProperty.call(OBJECTIVE_TYPES, 'combat'));
    });

    it('every registry entry has the full shared shape', () => {
        const requiredKeys = ['label', 'icon', 'progressLabel', 'progressVerb', 'reliefLabel', 'reliefVerb', 'description'];
        for (const [id, entry] of Object.entries(OBJECTIVE_TYPES)) {
            for (const key of requiredKeys) {
                assertTrue(
                    Object.prototype.hasOwnProperty.call(entry, key) && !!entry[key],
                    `${id}.${key} should be present and truthy`
                );
            }
        }
    });

    it('contains exactly the eight documented types', () => {
        const ids = Object.keys(OBJECTIVE_TYPES).sort();
        assertEqual(
            ids.join(','),
            ['combat', 'custom', 'heist', 'lockpick', 'obstruction', 'skill_challenge', 'social', 'trap_ward'].join(',')
        );
    });

    it('combat is the only type with Harm/Heal vocabulary', () => {
        assertEqual(OBJECTIVE_TYPES.combat.progressLabel, 'Harm');
        assertEqual(OBJECTIVE_TYPES.combat.reliefLabel, 'Heal');
        for (const [id, entry] of Object.entries(OBJECTIVE_TYPES)) {
            if (id === 'combat') continue;
            assert(entry.progressLabel !== 'Harm', `${id} should not reuse combat's "Harm" label`);
            assert(entry.reliefLabel !== 'Heal', `${id} should not reuse combat's "Heal" label`);
        }
    });

    it('listObjectiveTypes returns [id, entry] pairs matching the registry', () => {
        const pairs = listObjectiveTypes();
        assertEqual(pairs.length, Object.keys(OBJECTIVE_TYPES).length);
        for (const [id, entry] of pairs) {
            assertEqual(entry, OBJECTIVE_TYPES[id]);
        }
    });
});

describe('objective-types: getObjectiveType fallback (never throws)', () => {

    it('resolves a known id to its own entry', () => {
        assertEqual(getObjectiveType('lockpick'), OBJECTIVE_TYPES.lockpick);
        assertEqual(getObjectiveType('lockpick').progressLabel, 'Tumblers');
    });

    it('falls back to combat for a missing/undefined type — the exact case every pre-existing saved combatant/encounter/clock hits', () => {
        assertEqual(getObjectiveType(undefined), OBJECTIVE_TYPES.combat);
        assertEqual(getObjectiveType(null), OBJECTIVE_TYPES.combat);
        assertEqual(getObjectiveType(''), OBJECTIVE_TYPES.combat);
    });

    it('falls back to combat for an unrecognized id instead of throwing', () => {
        assertEqual(getObjectiveType('not-a-real-type'), OBJECTIVE_TYPES.combat);
        assertEqual(getObjectiveType(123), OBJECTIVE_TYPES.combat);
        assertEqual(getObjectiveType({}), OBJECTIVE_TYPES.combat);
    });

    it('does not fall victim to prototype-pollution-style lookups (e.g. "constructor", "toString")', () => {
        assertEqual(getObjectiveType('constructor'), OBJECTIVE_TYPES.combat);
        assertEqual(getObjectiveType('hasOwnProperty'), OBJECTIVE_TYPES.combat);
    });
});

describe('objective-types: isCombatType', () => {

    it('true for combat and for missing/unrecognized ids — a combatant/clock entry with no `type` field is treated as combat', () => {
        assertTrue(isCombatType('combat'));
        assertTrue(isCombatType(undefined));
        assertTrue(isCombatType(null));
        assertTrue(isCombatType(''));
        assertTrue(isCombatType('nonsense'));
    });

    it('false for every other real objective type', () => {
        for (const id of Object.keys(OBJECTIVE_TYPES)) {
            if (id === 'combat') continue;
            assertFalse(isCombatType(id), `${id} should not be treated as combat`);
        }
    });
});

describe('objective-types: isCustomType', () => {
    it('true only for the custom/freeform entry', () => {
        assertTrue(isCustomType('custom'));
        assertFalse(isCustomType('combat'));
        assertFalse(isCustomType(undefined));
        assertFalse(isCustomType('lockpick'));
    });
});

describe('objective-types: resolveObjectiveType', () => {

    it('a custom type with customLabel/customTickLabel supplied returns those exact strings', () => {
        const resolved = resolveObjectiveType('custom', { customLabel: 'Ritual Completion', customTickLabel: 'chant' });
        assertEqual(resolved.progressLabel, 'Ritual Completion');
        assertEqual(resolved.progressVerb, 'chant');
        assertEqual(resolved.reliefLabel, 'Ritual Completion (Back)');
        assertEqual(resolved.reliefVerb, 'chant');
    });

    it('a custom type with no override falls back to "Timer"/"tick"', () => {
        const resolved = resolveObjectiveType('custom');
        assertEqual(resolved.progressLabel, 'Timer');
        assertEqual(resolved.progressVerb, 'tick');

        const resolvedEmpty = resolveObjectiveType('custom', { customLabel: '', customTickLabel: '   ' });
        assertEqual(resolvedEmpty.progressLabel, 'Timer');
        assertEqual(resolvedEmpty.progressVerb, 'tick');
    });

    it('a non-custom type ignores any customLabel/customTickLabel present on the source object', () => {
        const resolved = resolveObjectiveType('combat', { customLabel: 'Ritual Completion', customTickLabel: 'chant' });
        assertEqual(resolved, OBJECTIVE_TYPES.combat);
        assertEqual(resolved.progressLabel, 'Harm');
        assertEqual(resolved.reliefLabel, 'Heal');
    });
});
