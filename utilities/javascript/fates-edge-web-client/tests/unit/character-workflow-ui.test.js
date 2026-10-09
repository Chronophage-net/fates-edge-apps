import { describe, it, assert, assertEqual } from '../runner.js';
import { matchesCatalogQuery, collectTalentRecord } from '../../js/features/characters/catalog-utils.js';
import { readFileSync } from 'node:fs';

describe('Character catalog search', () => {
    it('matches words across name, description, prerequisites and tags', () => {
        const talent={name:'Iron Skin',description:'Convert Harm to Fatigue',prerequisites:'Body 2+',tags:['defense']};
        assert(matchesCatalogQuery(talent,'IRON fatigue'));
        assert(matchesCatalogQuery(talent,'body defense'));
        assert(!matchesCatalogQuery(talent,'arcana'));
        assert(matchesCatalogQuery(talent,'  '));
    });
    it('supports wiki titles and bodies without requiring optional fields', () => {
        assert(matchesCatalogQuery({title:'Keen Senses',body:'Spot hidden danger'},'hidden'));
        assert(!matchesCatalogQuery({},'hidden'));
    });
});
describe('Wizard talent preservation', () => {
    it('retains identity, description, activation and effects across collection', () => {
        const talent={id:'keen',name:'Keen Senses',cost:2,description:'Spot danger',activation:'passive',effects:[{type:'dice',value:1}]};
        const collected=collectTalentRecord([talent],'Keen Senses',2);
        assertEqual(JSON.stringify(collected),JSON.stringify(talent));
        assert(collected !== talent);
    });
    it('does not copy mechanical effects onto a renamed custom talent', () => {
        const result=collectTalentRecord([{name:'Old',cost:2,effects:[{}]}],'Custom',3);
        assertEqual(JSON.stringify(result),JSON.stringify({name:'Custom',cost:3}));
    });
    it('uses one delegated add handler and collects full talent records', () => {
        const source=readFileSync(new URL('../../js/features/characters/wizard.js',import.meta.url),'utf8');
        assert(!source.includes("catalogContainer.querySelectorAll('.catalog-add-btn')"));
        const read=source.slice(source.indexOf('function readTalentListFromDOM()'),source.indexOf('function readBondList()'));
        assert(read.includes('collectTalentRecord'));
        const summary=source.slice(source.indexOf('function updateSummaryDisplay()'),source.indexOf('function dynamicRowHtml('));
        assert(!summary.includes('readTalentListFromDOM()'), 'Summary must not clear talents from an absent form');
    });
});
describe('Character XP display', () => {
    it('prefers total XP and preserves a real zero over legacy defaults', () => {
        const source=readFileSync(new URL('../../js/components/CharacterCard.js',import.meta.url),'utf8');
        assert(source.includes('char.totalXp ?? char.xp ?? 32'));
    });
});
