/**
 * Minimal headless DOM/browser shim for running the test suite under plain
 * `node`, without pulling in a heavy dependency like jsdom.
 *
 * Only implements the surface actually touched by the code under test:
 * document.getElementById/createElement/dispatchEvent/body,
 * a tiny element stub (classList/style/appendChild/textContent/innerHTML/
 * setAttribute/addEventListener), an in-memory localStorage, and a
 * window/navigator stub with the couple of properties the app reads.
 *
 * This file must be imported before any production module so its globals
 * exist by the time those modules' top-level code runs.
 */

function createElementStub(tag) {
    const el = {
        tagName: String(tag || '').toUpperCase(),
        children: [],
        attributes: {},
        style: {},
        className: '',
        textContent: '',
        innerHTML: '',
        id: '',
        classList: {
            add() {},
            remove() {},
            toggle() {},
            contains() { return false; }
        },
        appendChild(child) {
            this.children.push(child);
            return child;
        },
        removeChild(child) {
            this.children = this.children.filter(c => c !== child);
            return child;
        },
        setAttribute(name, value) {
            this.attributes[name] = value;
        },
        getAttribute(name) {
            return Object.prototype.hasOwnProperty.call(this.attributes, name)
                ? this.attributes[name]
                : null;
        },
        removeAttribute(name) {
            delete this.attributes[name];
        },
        addEventListener() {},
        removeEventListener() {},
        dispatchEvent() { return true; },
        querySelector() { return null; },
        querySelectorAll() { return []; }
    };
    return el;
}

// A tiny real (not no-op) EventTarget-alike, since production code
// (e.g. js/features/factions/index.js dispatching 'downtime-tick' for
// js/features/crafting/index.js to react to) uses document as a genuine
// cross-feature event bus, not just DOM plumbing to be stubbed out.
function createEventTargetMixin() {
    const listeners = new Map(); // type -> Set<fn>
    return {
        addEventListener(type, fn) {
            if (!listeners.has(type)) listeners.set(type, new Set());
            listeners.get(type).add(fn);
        },
        removeEventListener(type, fn) {
            listeners.get(type)?.delete(fn);
        },
        dispatchEvent(event) {
            const fns = listeners.get(event?.type);
            if (fns) for (const fn of [...fns]) fn(event);
            return true;
        }
    };
}

// Minimal CustomEvent so `new CustomEvent('x', { detail })` works the
// same as in a real browser.
class CustomEventShim {
    constructor(type, opts = {}) {
        this.type = type;
        this.detail = opts.detail;
        this.bubbles = !!opts.bubbles;
        this.cancelable = !!opts.cancelable;
    }
}

function createMemoryStorage() {
    const store = new Map();
    return {
        getItem(key) {
            return store.has(key) ? store.get(key) : null;
        },
        setItem(key, value) {
            store.set(key, String(value));
        },
        removeItem(key) {
            store.delete(key);
        },
        clear() {
            store.clear();
        },
        key(index) {
            return Array.from(store.keys())[index] ?? null;
        },
        get length() {
            return store.size;
        }
    };
}

export function installDomShim() {
    if (typeof globalThis.__FE_DOM_SHIM_INSTALLED__ !== 'undefined') {
        return;
    }
    globalThis.__FE_DOM_SHIM_INSTALLED__ = true;

    if (typeof globalThis.CustomEvent === 'undefined') {
        globalThis.CustomEvent = CustomEventShim;
    }

    if (typeof globalThis.document === 'undefined') {
        globalThis.document = {
            body: createElementStub('body'),
            getElementById() { return null; },
            createElement(tag) { return createElementStub(tag); },
            createTextNode(text) { return { nodeType: 3, textContent: text }; },
            querySelector() { return null; },
            querySelectorAll() { return []; },
            head: createElementStub('head'),
            ...createEventTargetMixin()
        };
    }

    if (typeof globalThis.localStorage === 'undefined') {
        globalThis.localStorage = createMemoryStorage();
    }

    if (typeof globalThis.window === 'undefined') {
        globalThis.window = {
            location: {
                origin: 'http://localhost',
                protocol: 'http:',
                href: 'http://localhost/'
            },
            localStorage: globalThis.localStorage,
            addEventListener() {},
            removeEventListener() {},
            DOMPurify: undefined
        };
    }

    if (typeof globalThis.navigator === 'undefined') {
        globalThis.navigator = {
            onLine: true,
            userAgent: 'node-test-runner'
        };
    }

    // Modern Node ships a real global WebSocket (added in Node 20/22).
    // Production code (js/core/sync/index.js SyncManager.connect) uses
    // `typeof WebSocket === 'undefined'` as its "are we in a test/non-browser
    // environment" check, and short-circuits to a resolved connect() without
    // opening a real socket in that case - which is exactly what the mocked
    // sync tests rely on (they inject a mock socket and expect connect() to
    // leave it alone). Node's real WebSocket would otherwise silently
    // replace the injected mock and try to dial an actual server, hanging
    // the test until it times out. Undefine it here so the suite exercises
    // the same code path it always has.
    if (typeof globalThis.WebSocket !== 'undefined') {
        try {
            delete globalThis.WebSocket;
        } catch {
            globalThis.WebSocket = undefined;
        }
    }
}

installDomShim();
