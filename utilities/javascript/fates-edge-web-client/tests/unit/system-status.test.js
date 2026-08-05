import { describe, it, assert } from '../runner.js';
import systemStatus, { render, onDeactivate, destroy } from '../../js/features/system-status/index.js';

function makeContainer() {
    return {
        innerHTML: '',
        isConnected: true,
        querySelector() { return null; },
        querySelectorAll() { return []; }
    };
}

describe('System Status module', () => {
    it('exposes the module-loader lifecycle contract (render/onDeactivate/destroy)', () => {
        assert(typeof render === 'function');
        assert(typeof onDeactivate === 'function');
        assert(typeof destroy === 'function');
        assert(typeof systemStatus.render === 'function');
    });

    it('onDeactivate()/destroy() are safe no-ops before render() has ever run', () => {
        onDeactivate();
        destroy();
    });

    it('render() populates the container with every status section, disconnected/idle by default', async () => {
        const container = makeContainer();
        try {
            await render(container);

            assert(container.innerHTML.includes('System Status'));
            assert(container.innerHTML.includes('Real-Time Server'));
            assert(container.innerHTML.includes('Voice Chat'));
            assert(container.innerHTML.includes('Session Recording'));
            assert(container.innerHTML.includes('Sync / Offline Queue'));
            assert(container.innerHTML.includes('Connected Clients'));
            assert(container.innerHTML.includes('Browser Capabilities'));

            // Test environment starts fully disconnected (see websocket.js
            // default state) -- this should render as disconnected, not throw.
            assert(container.innerHTML.includes('Disconnected'));
        } finally {
            // Always clear the auto-refresh interval render() started,
            // otherwise it keeps the test process alive after the suite
            // finishes reporting.
            destroy();
        }
    });

    it('destroy() actually stops the auto-refresh interval (render() can be safely re-run afterward)', async () => {
        const container = makeContainer();
        await render(container);
        destroy();
        // A second render()/destroy() cycle should behave identically, not
        // throw, and not leave two overlapping intervals running.
        await render(container);
        destroy();
        assert(container.innerHTML.includes('System Status'));
    });
});
