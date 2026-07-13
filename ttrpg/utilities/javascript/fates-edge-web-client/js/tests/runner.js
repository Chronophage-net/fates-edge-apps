/**
 * Test Runner for Fate's Edge Toolkit
 * Minimal testing framework with assertion support
 */

import { syncManager } from '../core/sync/index.js';
import { getState, loadState, saveState } from '../core/state.js';

// ===== Test Framework =====

const TESTS = [];
let currentTest = null;
let testResults = [];
let testCount = 0;
let passCount = 0;
let failCount = 0;

// ===== Assertions =====

export function assert(condition, message) {
    if (!condition) {
        throw new Error(message || 'Assertion failed');
    }
}

export function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(`${message || 'Assertion failed'}: expected ${expected}, got ${actual}`);
    }
}

export function assertDeepEqual(actual, expected, message) {
    const actualStr = JSON.stringify(actual);
    const expectedStr = JSON.stringify(expected);
    if (actualStr !== expectedStr) {
        throw new Error(`${message || 'Assertion failed'}: expected ${expectedStr}, got ${actualStr}`);
    }
}

export function assertTrue(value, message) {
    if (value !== true) {
        throw new Error(message || `Expected true, got ${value}`);
    }
}

export function assertFalse(value, message) {
    if (value !== false) {
        throw new Error(message || `Expected false, got ${value}`);
    }
}

export function assertThrows(fn, message) {
    let threw = false;
    try {
        fn();
    } catch (e) {
        threw = true;
    }
    if (!threw) {
        throw new Error(message || 'Expected function to throw');
    }
}

// ===== Test Registration =====

export function describe(name, fn) {
    const suite = { name, tests: [] };
    currentTest = suite;
    fn();
    TESTS.push(suite);
    currentTest = null;
}

export function it(name, fn) {
    if (!currentTest) {
        throw new Error('it() must be called inside describe()');
    }
    currentTest.tests.push({ name, fn });
}

// ===== Test Running =====

export async function runTests() {
    testResults = [];
    testCount = 0;
    passCount = 0;
    failCount = 0;
    
    const results = document.getElementById('test-results');
    const summary = document.getElementById('test-summary');
    const details = document.getElementById('test-details');
    
    if (results) results.innerHTML = '';
    if (details) details.innerHTML = '';
    
    for (const suite of TESTS) {
        for (const test of suite.tests) {
            testCount++;
            const startTime = performance.now();
            let passed = false;
            let error = null;
            
            try {
                // Reset state before each test
                localStorage.removeItem('fates-edge-data');
                loadState();
                
                await test.fn();
                passed = true;
                passCount++;
            } catch (e) {
                error = e;
                failCount++;
            }
            
            const duration = (performance.now() - startTime).toFixed(2);
            
            const result = {
                suite: suite.name,
                name: test.name,
                passed,
                error,
                duration
            };
            testResults.push(result);
            
            // Update UI
            if (results) {
                const div = document.createElement('div');
                div.className = `test-item ${passed ? 'pass' : 'fail'}`;
                div.innerHTML = `
                    <span class="test-status">${passed ? '✅' : '❌'}</span>
                    <span class="test-name">${suite.name} › ${test.name}</span>
                    <span class="test-duration">${duration}ms</span>
                    ${error ? `<div class="test-error">${error.message}</div>` : ''}
                `;
                results.appendChild(div);
            }
        }
    }
    
    // Update summary
    if (summary) {
        summary.innerHTML = `
            <div class="summary-stats">
                <span class="stat total">📊 ${testCount} tests</span>
                <span class="stat pass">✅ ${passCount} passed</span>
                <span class="stat fail">❌ ${failCount} failed</span>
                <span class="stat duration">⏱️ ${testResults.reduce((sum, r) => sum + parseFloat(r.duration), 0).toFixed(2)}ms</span>
            </div>
            <div class="summary-bar">
                <div class="bar-pass" style="width:${testCount > 0 ? (passCount / testCount * 100) : 0}%;"></div>
                <div class="bar-fail" style="width:${testCount > 0 ? (failCount / testCount * 100) : 0}%;"></div>
            </div>
        `;
    }
    
    return { total: testCount, passed: passCount, failed: failCount };
}

// ===== Test Helpers =====

export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export function createMockState() {
    return {
        characters: [],
        timers: [],
        wiki: [],
        rollHistory: [],
        talents: [],
        chatHistory: [],
        encounters: [],
        npcs: [],
        hiddenRemoteIds: [],
        _nextId: 1,
        _nextTalentId: 1,
        _nextEncounterId: 1,
        _nextNpcId: 1
    };
}

export function createMockCharacter(id, name) {
    return {
        id: id || 'char-' + Date.now(),
        name: name || 'Test Character',
        body: 3,
        wits: 2,
        spirit: 1,
        presence: 1,
        skills: {},
        talents: [],
        assets: [],
        equipment: [],
        bonds: [],
        complications: [],
        harm: 0,
        fatigue: 0,
        boons: 0,
        vtt: false
    };
}

// ===== Mock WebSocket =====

export function createMockWebSocket() {
    const handlers = {};
    let isOpen = false;
    let messages = [];
    
    const ws = {
        readyState: 0,
        onopen: null,
        onmessage: null,
        onclose: null,
        onerror: null,
        
        send(data) {
            messages.push(data);
            // Simulate echo
            if (handlers['*']) {
                handlers['*'](JSON.parse(data));
            }
        },
        
        close() {
            isOpen = false;
            if (this.onclose) this.onclose({ code: 1000 });
        },
        
        // Test helpers
        _open() {
            isOpen = true;
            this.readyState = 1;
            if (this.onopen) this.onopen();
        },
        
        _receive(data) {
            if (this.onmessage) {
                this.onmessage({ data: JSON.stringify(data) });
            }
        },
        
        _getMessages() {
            return messages;
        },
        
        _clearMessages() {
            messages = [];
        },
        
        _registerHandler(type, handler) {
            handlers[type] = handler;
        },
        
        _close(code, reason) {
            if (this.onclose) this.onclose({ code, reason });
        }
    };
    
    return ws;
}

// ===== Mock Storage =====

export function createMockStorage() {
    const store = {};
    return {
        getItem(key) {
            return store[key] || null;
        },
        setItem(key, value) {
            store[key] = String(value);
        },
        removeItem(key) {
            delete store[key];
        },
        clear() {
            Object.keys(store).forEach(key => delete store[key]);
        },
        _getStore() {
            return store;
        }
    };
}

// ===== Run Tests on Load =====

export function initTestRunner() {
    // Override localStorage with mock for tests if not already
    if (typeof window !== 'undefined' && !window._originalLocalStorage) {
        window._originalLocalStorage = { ...localStorage };
    }
    
    // Add test button to UI
    const container = document.getElementById('test-container');
    if (container) {
        const btn = document.createElement('button');
        btn.className = 'btn btn-gold';
        btn.textContent = '▶ Run All Tests';
        btn.onclick = async () => {
            btn.disabled = true;
            btn.textContent = 'Running...';
            await runTests();
            btn.disabled = false;
            btn.textContent = '▶ Run All Tests';
        };
        container.appendChild(btn);
    }
}

// Export for use in tests
export default {
    describe,
    it,
    assert,
    assertEqual,
    assertDeepEqual,
    assertTrue,
    assertFalse,
    assertThrows,
    runTests,
    sleep,
    createMockState,
    createMockCharacter,
    createMockWebSocket,
    createMockStorage,
    initTestRunner
};
