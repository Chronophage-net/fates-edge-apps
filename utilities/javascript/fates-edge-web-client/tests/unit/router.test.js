import { describe, it, assert, assertEqual } from '../runner.js';
import { navigate, getCurrentTab } from '../../js/router.js';
import { moduleLoader } from '../../js/module-loader.js';
import { connectWebSocket, disconnectWebSocket } from '../../js/core/websocket.js';

async function withRouterDOM(test) {
    const original = {
        getElementById: document.getElementById, querySelector: document.querySelector,
        querySelectorAll: document.querySelectorAll, createElement: document.createElement,
        title: document.title, history: window.history, hash: window.location.hash,
        imports: moduleLoader.importFns, render: moduleLoader.renderModule,
    };
    const panels = new Map();
    const main = { appendChild(el) { panels.set(el.id, el); } };
    document.createElement = tag => {
        const el = original.createElement(tag);
        el.focus = () => {};
        el.hasAttribute = name => el.getAttribute(name) !== null;
        return el;
    };
    document.getElementById = id => panels.get(id) || null;
    document.querySelector = selector => selector === 'main' ? main : null;
    document.querySelectorAll = selector => selector === '.tab-content' ? [...panels.values()] : [];
    window.history = { replaceState(_state, _title, hash) { window.location.hash = hash; } };
    moduleLoader.importFns = new Map(['home', 'characters', 'gm-tools'].map(key => [key, () => {}]));
    const rendered = [];
    moduleLoader.renderModule = async name => { rendered.push(name); return {}; };
    try { await test(panels, rendered); }
    finally {
        Object.assign(document, { getElementById: original.getElementById, querySelector: original.querySelector,
            querySelectorAll: original.querySelectorAll, createElement: original.createElement, title: original.title });
        window.history = original.history;
        window.location.hash = original.hash;
        moduleLoader.importFns = original.imports;
        moduleLoader.renderModule = original.render;
    }
}

describe('Route safety and panel ownership', () => {
    it('renders an unknown route as text in a dedicated recovery panel', () => withRouterDOM(async panels => {
        await navigate('<img src=x onerror=alert(1)>');
        const panel = panels.get('tab-not-found');
        assert(panel.innerHTML.includes('&lt;img'));
        assert(!panel.innerHTML.includes('<img'));
        assert(panel.innerHTML.includes('href="#home"'));
        await navigate('constructor');
        assertEqual(getCurrentTab(), 'constructor', 'inherited object keys are not redirects');
        assertEqual(panels.size, 1, 'unknown routes reuse one recovery panel');
    }));
    it('keeps each feature in its own container', () => withRouterDOM(async panels => {
        await navigate('home');
        const home = panels.get('tab-home');
        await navigate('characters');
        assertEqual(home.id, 'tab-home');
        assert(panels.get('tab-characters') !== home);
    }));
    it('checks role access after a legacy redirect', () => withRouterDOM(async (_panels, rendered) => {
        const original = globalThis.WebSocket;
        const role = localStorage.getItem('fates-edge-my-role');
        let client;
        class FakeWebSocket {
            static OPEN = 1;
            constructor() { client = this; this.readyState = 1; }
            send() {}
            close() { this.readyState = 3; }
        }
        globalThis.WebSocket = FakeWebSocket;
        try {
            connectWebSocket('TEST', 'wss://example.test');
            client.onopen();
            client.onmessage({ data: JSON.stringify({ type: 'handshake_ack', success: true, clientId: 'player-test' }) });
            localStorage.setItem('fates-edge-my-role', 'player');
            await navigate('scene-tools', { _isInitialLoad: true });
            assertEqual(rendered.join(','), 'home', 'legacy route must not open GM tools for a player');
        } finally {
            disconnectWebSocket();
            globalThis.WebSocket = original;
            if (role === null) localStorage.removeItem('fates-edge-my-role');
            else localStorage.setItem('fates-edge-my-role', role);
        }
    }));
});
