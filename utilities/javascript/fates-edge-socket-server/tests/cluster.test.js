const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const clusterMod = require('../server/cluster.js');

/**
 * This test process is always the cluster PRIMARY from Node's own
 * perspective (require('cluster').isWorker is false unless we're actually
 * inside a forked worker) -- so what's testable here is the config-gating
 * logic and the graceful no-op paths, same scope scaling.test.js covers
 * for the Redis path. Actually forking workers and verifying cross-worker
 * delivery requires a real multi-process run, which is closer to a
 * deployment smoke test than a unit test -- see SCALING.md's "Multi-core
 * scaling" section for how that was verified manually during development
 * (two real Socket.IO clients landing on two different worker PIDs, with
 * a broadcast from one reaching the other via @socket.io/cluster-adapter).
 */
describe('cluster.js shouldUseCluster()', () => {
    test('false when clusterWorkers is 0 (default/unset)', () => {
        assert.equal(clusterMod.shouldUseCluster({ clusterWorkers: 0 }), false);
    });

    test('false when clusterWorkers is 1 (a single "worker" is just a single process)', () => {
        assert.equal(clusterMod.shouldUseCluster({ clusterWorkers: 1 }), false);
    });

    test('true when clusterWorkers is an integer > 1', () => {
        assert.equal(clusterMod.shouldUseCluster({ clusterWorkers: 4 }), true);
    });

    test('handles a missing clusterWorkers key without throwing', () => {
        assert.doesNotThrow(() => clusterMod.shouldUseCluster({}));
        assert.equal(clusterMod.shouldUseCluster({}), false);
    });
});

describe('cluster.js attachWorkerAdapter() outside a cluster worker', () => {
    test('is a no-op (returns false) when this process is not a cluster worker', () => {
        let adapterCalled = false;
        const fakeIo = { adapter: () => { adapterCalled = true; } };
        const logger = { info: () => {}, warn: () => {}, error: () => {} };

        const result = clusterMod.attachWorkerAdapter(fakeIo, { redisUrl: null }, logger);

        assert.equal(result, false);
        assert.equal(adapterCalled, false, 'must not touch the Socket.IO adapter outside a cluster worker');
    });
});

describe('cluster.js initClusterWsRelay()', () => {
    test('is a no-op when this process is not a cluster worker', () => {
        const logger = { info: () => {}, warn: () => {}, error: () => {} };
        const result = clusterMod.initClusterWsRelay({ redisUrl: null }, logger, () => {});
        assert.deepEqual(result, { enabled: false });
    });

    test('is a no-op when Redis is already configured, even conceptually under cluster (Redis takes priority)', () => {
        // Can't simulate cluster.isWorker=true from outside a forked
        // process, but the redisUrl short-circuit is checked FIRST in the
        // implementation (see cluster.js), so this exercises that branch
        // regardless of which process we're actually running in.
        const logger = { info: () => {}, warn: () => {}, error: () => {} };
        const result = clusterMod.initClusterWsRelay({ redisUrl: 'redis://127.0.0.1:6399' }, logger, () => {});
        assert.deepEqual(result, { enabled: false });
    });
});

// The require()-fails fallback (CLUSTER_WORKERS set but @socket.io/sticky /
// @socket.io/cluster-adapter genuinely not installed) is exercised by
// runPrimary()'s/attachWorkerAdapter()'s try/catch around those requires;
// not covered here since the deps are real optionalDependencies and
// normally present in this test environment -- same caveat scaling.test.js
// already documents for the Redis equivalent.
