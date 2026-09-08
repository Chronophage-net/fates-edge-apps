import { describe, it, assertEqual } from '../runner.js';
import { auditCss } from '../../js/tools/css-audit.js';

// A var() with no fallback that names an undefined property doesn't fall back
// to anything — it invalidates the whole declaration. Nineteen of these had
// accumulated (--accent, --warn, --danger, --font, --panel, --ink …), quietly
// voiding colours and panel backgrounds across ten feature modules. Keep the
// count at zero: either define the token or write var(--x, fallback).
describe('CSS custom properties', () => {
    it('every var() the app references is defined somewhere', () => {
        const { undefinedVars } = auditCss();
        const names = undefinedVars.map(v => `${v.name} (${v.files[0]})`);
        assertEqual(names.join('\n'), '', 'undefined custom properties');
    });
});
