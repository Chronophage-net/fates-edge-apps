import { describe, it, assertEqual, assertTrue } from '../runner.js';

const loadFirstPartyInterfaceSources = async () => {
    const { readFileSync, readdirSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const path = await import('node:path');
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
    const files = [path.join(root, 'index.html'), path.join(root, 'css', 'app.css')];

    const visit = dir => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) visit(full);
            else if (entry.name.endsWith('.js') || entry.name.endsWith('.html')) files.push(full);
        }
    };
    visit(path.join(root, 'js'));

    return files.map(file => ({
        file: path.relative(root, file),
        source: readFileSync(file, 'utf8'),
    }));
};

const physicalProperty = /(?:margin|padding)-(?:left|right)\s*:|border-(?:left|right)(?:-color|-style|-width)?\s*:|border-(?:top|bottom)-(?:left|right)-radius\s*:|text-align\s*:\s*(?:left|right)\b|float\s*:\s*(?:left|right)\b|clear\s*:\s*(?:left|right)\b|(?:^|[;{]\s*|\s)(?:left|right)\s*:/;

describe('RTL layout: source guard', () => {
    it('uses logical CSS properties unless a physical coordinate is documented', async () => {
        const sources = await loadFirstPartyInterfaceSources();
        const violations = [];

        for (const { file, source } of sources) {
            source.split('\n').forEach((line, index) => {
                if (!physicalProperty.test(line)) return;
                if (line.includes('rtl-physical:')) return;
                // `left` is the semantic name of a Crown Spread card, not CSS.
                if (/^\s*left:\s*`/.test(line)) return;
                violations.push(`${file}:${index + 1}: ${line.trim()}`);
            });
        }

        assertEqual(violations.join('\n'), '', `physical-direction CSS needs a logical property or an rtl-physical explanation\n${violations.join('\n')}`);
    });

    it('includes explicit RTL counterparts for directional motion and select affordances', async () => {
        const sources = await loadFirstPartyInterfaceSources();
        const css = sources.find(item => item.file === 'css/app.css')?.source || '';
        assertTrue(css.includes('[dir="rtl"] select { background-position: left'), 'select arrow should move to the inline end');
        assertTrue(css.includes('[dir="rtl"] .toast'), 'toast motion should enter and leave from the RTL edge');
        assertTrue(css.includes('[dir="rtl"] .nav-item:hover'), 'navigation hover motion should follow writing direction');
        assertTrue(css.includes('[dir="rtl"] .bestiary-entry:hover'), 'list hover motion should follow writing direction');
    });
});
