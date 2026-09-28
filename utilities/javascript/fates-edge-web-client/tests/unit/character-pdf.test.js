import { describe, it, assert, assertEqual, createMockCharacter } from '../runner.js';
import { buildCharacterPDF } from '../../js/features/characters/character-pdf.js';

describe('Bundled character PDF export', () => {
    it('generates a landscape core sheet without CDN globals', () => {
        const character = createMockCharacter('pdf-test', 'Test Character');
        const pdf = buildCharacterPDF(character);
        assertEqual(pdf.getNumberOfPages(), 1);
        assertEqual(pdf.internal.pageSize.getWidth(), 792);
        assertEqual(pdf.internal.pageSize.getHeight(), 612);
        assert(pdf.output().startsWith('%PDF-'), 'a real PDF is produced');
        assertEqual(buildCharacterPDF(null), null);
    });
    it('renders company and magic practice pages with the updated table library', () => {
        const character = createMockCharacter('pdf-magic', 'Mage');
        character.assets = [{ name: 'Workshop', description: 'A quiet place to work.' }];
        for (const magicPath of ['free-caster', 'runekeeper', 'invoker', 'cantor', 'witch', 'psion', 'summoner', 'monk']) {
            const pdf = buildCharacterPDF({ ...character, magicPath });
            assert(pdf.getNumberOfPages() >= 3, `${magicPath} has core, company and practice pages`);
            assert(pdf.output('arraybuffer').byteLength > 1000);
        }
    });
});
