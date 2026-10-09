import { describe, it, assert, assertEqual } from '../runner.js';
import { validTimerInput, setupTableUI, showTimerForm } from '../../js/features/vtt/table-ui.js';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

describe('VTT timer input', () => {
    it('accepts named timers with whole-number segments', () => {
        assert(validTimerInput('Scene', 6));
        assert(validTimerInput(' One ', 1));
        assert(validTimerInput('Long', 60));
    });
    it('rejects blank names, oversized names and invalid segment counts', () => {
        for (const name of ['', '  ', 'x'.repeat(101), null]) assert(!validTimerInput(name, 6));
        for (const count of [0, -1, 1.5, 61, NaN, Infinity, '6']) assert(!validTimerInput('Scene', count));
    });
    it('is safe when the table has unmounted', () => {
        showTimerForm(null, () => { throw new Error('must not create'); });
        setupTableUI({querySelector:()=>null});
    });
});

describe('VTT local timer and message integration', () => {
    const local = readFileSync(new URL('../../js/features/vtt/vtt-local.js', import.meta.url), 'utf8');
    it('persists new timers through the state API', () => {
        const block=local.slice(local.indexOf("case 'vtt-add-timer':"),local.indexOf("case 'vtt-scene-end':"));
        assert(block.includes('addTimer(timer)'));
        assert(block.includes('showTimerForm(container'));
        assert(!block.includes('prompt('));
    });
    it('does not label an offline message as a failed network send', () => {
        const start=local.indexOf('function createLocalMessage(');
        const end=local.indexOf('\nexport function sendMessage(',start);
        const create=vm.runInNewContext(`${local.slice(start,end)}; createLocalMessage;`);
        const message=create('Hello','Player','all',{});
        assertEqual(message.local,true);
        assertEqual(message.sent,null);
    });
    it('uses the same form and navigation in connected mode', () => {
        const connected=readFileSync(new URL('../../js/features/vtt/vtt-connected.js', import.meta.url),'utf8');
        assert(connected.includes('setupTableUI(el)'));
        assert(connected.includes('showTimerForm(container'));
    });
});

describe('VTT live message count', () => {
    it('removes the static translation marker and follows chat updates', () => {
        const core=readFileSync(new URL('../../js/features/vtt/vtt-core.js', import.meta.url),'utf8');
        const start=core.indexOf('export function updateMessageCount()');
        const end=core.indexOf('\n}',start)+2;
        const label={textContent:'',removeAttribute(name){this.removed=name;}};
        let notify;
        const context={currentContainer:{querySelector:()=>label},countUnsubscribe:null,vttStore:{subscribe(key,callback){notify=callback;callback([]);return ()=>{};}},i18nPlural:(key,count)=>`${count} messages`};
        vm.runInNewContext(`${core.slice(start,end).replace('export ','')}; updateMessageCount();`,context);
        assertEqual(label.removed,'data-i18n');
        notify([{},{}]);
        assertEqual(label.textContent,'2 messages');
    });
});
