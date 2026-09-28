import { describe, it, assert, assertEqual } from '../runner.js';
import { ModuleLoader } from '../../js/module-loader.js';

function deferred() {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}

describe('Module loading and recovery', () => {
    it('deduplicates imports while allowing callers to await the same module', async () => {
        const loader = new ModuleLoader();
        const pending = deferred();
        let calls = 0;
        loader.registerRoute('test', () => { calls++; return pending.promise; });
        const first = loader.loadModule('test');
        const second = loader.loadModule('test');
        pending.resolve({ render() {} });
        assertEqual(await first, await second);
        assertEqual(calls, 1);
    });
    it('does not render or activate a slow import after a newer navigation', async () => {
        const loader = new ModuleLoader();
        const pending = deferred();
        const oldPanel = document.createElement('div');
        const newPanel = document.createElement('div');
        let staleCalls = 0;
        loader.registerRoute('slow', () => pending.promise);
        loader.registerRoute('fast', async () => ({ render(el) { el.innerHTML = 'Ready'; } }));
        const oldNavigation = loader.renderModule('slow', oldPanel);
        assertEqual(oldPanel.getAttribute('aria-busy'), 'true');
        await loader.renderModule('fast', newPanel);
        pending.resolve({ render() { staleCalls++; }, onActivate() { staleCalls++; } });
        assertEqual(await oldNavigation, null);
        assertEqual(staleCalls, 0);
        assertEqual(loader.currentModule, 'fast');
        assertEqual(newPanel.innerHTML, 'Ready');
        assertEqual(oldPanel.getAttribute('aria-busy'), null);
        assertEqual(newPanel.getAttribute('aria-busy'), null);
    });
    it('cancels pending navigation when opening a missing page', async () => {
        const loader = new ModuleLoader();
        const pending = deferred();
        let renders = 0;
        loader.registerRoute('slow', () => pending.promise);
        const panel = document.createElement('div');
        const navigation = loader.renderModule('slow', panel);
        loader.cancelRender();
        pending.resolve({ render() { renders++; } });
        await navigation;
        assertEqual(renders, 0);
        assertEqual(panel.getAttribute('aria-busy'), null);
    });
    it('escapes error text and retries in the original panel', async () => {
        const loader = new ModuleLoader();
        const panel = document.createElement('div');
        let retry;
        panel.querySelector = () => ({ addEventListener(type, callback) { retry = callback; } });
        let attempts = 0;
        loader.registerRoute('retry', async () => {
            if (++attempts === 1) throw new Error('<img src=x onerror=alert(1)>');
            return { render(el) { el.innerHTML = 'Recovered'; } };
        });
        assertEqual(await loader.renderModule('retry', panel), null);
        assert(panel.innerHTML.includes('&lt;img'), 'error text is escaped');
        assert(!panel.innerHTML.includes('<img'), 'no executable error markup');
        assert(!panel.innerHTML.includes('onclick='), 'retry uses a listener');
        assertEqual(panel.getAttribute('aria-busy'), null);
        await retry();
        // The click callback returns the recovery promise so callers can observe completion.
        assertEqual(panel.innerHTML, 'Recovered');
        assertEqual(attempts, 2);
    });
});
