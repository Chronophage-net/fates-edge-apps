import { describe, it, assert, assertEqual } from '../runner.js';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../../js/features/spellcraft/index.js', import.meta.url), 'utf8');
const helperSource = source.slice(source.indexOf('function hasHedgeAccess('), source.indexOf('export async function renderActiveTabContent(')).replace('export function', 'function');
const available = vm.runInNewContext(`${helperSource}; getAvailableTabs;`);

describe('Spellcraft calculator tags', () => {
    it('recognizes calculator tags in the spellbook regardless of case', () => {
        const book = readFileSync(new URL('../../js/features/spellcraft/components/spellbook.js', import.meta.url), 'utf8');
        const canonical = book.slice(book.indexOf('function canonicalTag('), book.indexOf('\nfunction getCategoryIcon('));
        const normalize = vm.runInNewContext(`${canonical}; canonicalTag;`, {TAG_DEFINITIONS:{Burning:'heat',Strike:'precision'}});
        assertEqual(normalize('BURNING'), 'Burning');
        assertEqual(normalize('strike'), 'Strike');
        assertEqual(normalize('Custom'), 'Custom');
    });
    it('saves a captured tag list with its calculated difficulty', () => {
        const calculator = readFileSync(new URL('../../js/features/spellcraft/components/calculator.js', import.meta.url), 'utf8');
        const persist = calculator.slice(calculator.indexOf('function persistCalculatorSpell('), calculator.indexOf('\nfunction calculatorTestCast('));
        let saved;
        const context = vm.createContext({calculateDV:tags=>({dv:1+tags.length*2,breakdown:tags,totalMod:tags.length}), generateId:()=> 'test-spell',saveCharacter:value=>{saved=value;},showToast(){},i18nText(){},updateResult(){}, activeTags:[],spellHistory:[]});
        const save = vm.runInContext(`${persist}; persistCalculatorSpell;`, context);
        const char={id:'test',spellbook:[]};
        save(char,'Firebolt','Flame',['BURNING','STRIKE']);
        assertEqual(saved.spellbook[0].dv,5);
        assertEqual(saved.spellbook[0].tags.join(','),'BURNING,STRIKE');
        save(char,'Firebolt','Updated',['BURNING','STRIKE']);
        assertEqual(saved.spellbook.length,1);
        assertEqual(saved.spellbook[0].description,'Updated');
    });
    it('resolves every quick-template tag using the same uppercase keys as typed input', () => {
        const calculator = readFileSync(new URL('../../js/features/spellcraft/components/calculator.js', import.meta.url), 'utf8');
        const definitions = calculator.slice(calculator.indexOf('function buildTagDefinitions()'), calculator.indexOf('const CATEGORY_COLORS'));
        const templates = calculator.slice(calculator.indexOf('const SPELL_TEMPLATES ='), calculator.indexOf('\n];', calculator.indexOf('const SPELL_TEMPLATES =')) + 3);
        const {tags, presets} = vm.runInNewContext(`${definitions}\n${templates}\n({tags: buildTagDefinitions(), presets: SPELL_TEMPLATES});`);
        for (const preset of presets) {
            for (const tag of preset.tags) assert(tags.has(tag.toUpperCase()), `${preset.name}: ${tag}`);
        }
    });
});

describe('Spellcraft tool access', () => {
    it('preserves every tradition and always offers the spellbook', () => {
        for (const [path, tool] of Object.entries({'free-caster':'calculator',runekeeper:'rites',invoker:'rites',cantor:'cantor',witch:'witchcraft',psion:'psionics',summoner:'summoning',monk:'monks'})) {
            const ids = available({magicPath:path}).map(tab=>tab.id);
            assert(ids.includes('spellbook'),path);
            assert(ids.includes(tool),path);
        }
    });
    it('retains cross-path Hedge talent access without granting unrelated tools', () => {
        const ids = available({magicPath:'none',talents:[{id:'craft-of-the-hedge'}]}).map(tab=>tab.id);
        assertEqual(ids.join(','),'spellbook,witchcraft');
        assert(!available({magicPath:'none'}).some(tab=>tab.id==='calculator'));
    });
});

const rendererSource = source.slice(source.indexOf('export async function renderActiveTabContent('), source.indexOf('\nfunction renderAll()')).replace('export async', 'async');
function renderer(tool, render) {
    const panel = {innerHTML:'',children:[],attrs:{},setAttribute(k,v){this.attrs[k]=v;},appendChild(el){this.children.push(el);}};
    const context = vm.createContext({
        activeTab:tool,renderToken:0,TAB_HELP:{},
        document:{getElementById:()=>panel,createElement:()=>({innerHTML:'',textContent:''})},
        getCharacterData:()=>({id:'test'}),console:{error(){}},
        renderSpellbook:render,renderMonks:render,renderWitchcraft:render
    });
    vm.runInContext(rendererSource,context);
    return {panel,context,run:()=>vm.runInContext('renderActiveTabContent()',context)};
}
describe('Spellcraft asynchronous panels', () => {
    it('waits for spellbook, monks and witchcraft before finishing loading', async () => {
        for (const tool of ['spellbook','monks','witchcraft']) {
            let release;
            const gate = new Promise(resolve=>{release=resolve;});
            const ui=renderer(tool,async el=>{await gate;el.innerHTML='Ready';});
            const loading=ui.run();
            assertEqual(ui.panel.attrs['aria-busy'],'true');
            assertEqual(ui.panel.children.length,0);
            release();await loading;
            assertEqual(ui.panel.children.at(-1).innerHTML,'Ready');
            assertEqual(ui.panel.attrs['aria-busy'],'false');
        }
    });
    it('ignores a late panel after navigation invalidates its render token', async () => {
        let release;
        const gate=new Promise(resolve=>{release=resolve;});
        const ui=renderer('spellbook',async()=>gate);
        const pending=ui.run();
        ui.context.renderToken++;
        release();await pending;
        assertEqual(ui.panel.children.length,0);
    });
    it('catches asynchronous failures and offers a retry without exposing the error', async () => {
        const ui=renderer('witchcraft',async()=>{throw new Error('private diagnostic');});
        await ui.run();
        const html=ui.panel.children.at(-1).innerHTML;
        assert(html.includes('spellcraft-retry'));
        assert(!html.includes('private diagnostic'));
        assertEqual(ui.panel.attrs['aria-busy'],'false');
    });
    it('removes listeners from their original targets when leaving Spellcraft', () => {
        let removed=0;
        const destroySource=source.slice(source.indexOf('export function destroy()'),source.indexOf('// EXPORTS')).replace('export function','function');
        const context=vm.createContext({renderToken:0,tourTimer:null,clearTimeout(){},tourActive:true,container:{innerHTML:'',removeEventListener(){throw new Error('Wrong target');}},eventListeners:[{target:{removeEventListener(){removed++;}},event:'characterSelected',handler(){}}],document:{getElementById:()=>null}});
        vm.runInContext(`${destroySource};destroy();`,context);
        assertEqual(removed,1);
        assertEqual(context.renderToken,1);
        assertEqual(context.container,null);
    });
});
