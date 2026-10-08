import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getConnectionDefaults } from '../utilities/javascript/fates-edge-web-client/js/core/connection-defaults.js';
import { staticDataPlugin } from '../utilities/javascript/fates-edge-web-client/js/tools/static-data-plugin.js';
import { mkdtemp, mkdir, writeFile, readFile, access, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const server = 'utilities/javascript/fates-edge-socket-server/';
const client = 'utilities/javascript/fates-edge-web-client/';

test('NAS defaults use the browser-visible host and configured port, not player localhost', () => {
    assert.deepEqual(getConnectionDefaults({VITE_SELF_HOSTED_SERVER_PORT:'10001'}, {hostname:'192.168.1.50',protocol:'http:'}), {
        wsUrl:'ws://192.168.1.50:10001',serverUrl:'http://192.168.1.50:10001',room:'AC12'
    });
});
test('public TLS addresses and room overrides take precedence over LAN defaults', () => {
    assert.deepEqual(getConnectionDefaults({VITE_SELF_HOSTED_SERVER_PORT:'10000',VITE_WS_URL:'wss://game.example.com',VITE_SERVER_URL:'https://game.example.com',VITE_WS_ROOM:'TABLE'}, {hostname:'table.example.com',protocol:'https:'}), {
        wsUrl:'wss://game.example.com',serverUrl:'https://game.example.com',room:'TABLE'
    });
});
test('secure and IPv6 LAN URLs use valid schemes and authorities', () => {
    for (const hostname of ['fd00::1','[fd00::1]']) {
        const result = getConnectionDefaults({VITE_SELF_HOSTED_SERVER_PORT:'10000'}, {hostname,protocol:'https:'});
        assert.equal(result.wsUrl,'wss://[fd00::1]:10000');
        assert.equal(result.serverUrl,'https://[fd00::1]:10000');
    }
});
test('the combined stack passes public build defaults through the Dockerfile', () => {
    const compose = read('docker-compose.yml'), dockerfile = read(client+'Dockerfile');
    for (const key of ['VITE_SELF_HOSTED_SERVER_PORT','VITE_WS_URL','VITE_SERVER_URL']) {
        assert.match(compose,new RegExp(`${key}:`));
        assert.match(dockerfile,new RegExp(`ARG ${key}=`));
        assert.match(dockerfile,new RegExp(`ENV ${key}=`));
    }
    assert.match(read(client+'js/core/websocket.js'),/getConnectionDefaults/);
    assert.match(read(client+'js/features/settings/index.js'),/getConnectionDefaults/);
});
test('all nginx client health checks use the image-provided wget', () => {
    for (const file of ['docker-compose.yml','docker-compose.full.yml',client+'docker-compose.yml']) {
        assert.match(read(file),/wget.*http:\/\/localhost\/health/);
        assert.doesNotMatch(read(file),/test:.*curl.*localhost\/health/);
    }
});
test('standalone TURN is optional without parse-time mandatory secrets', () => {
    const compose = read(server+'docker-compose.yml');
    assert.match(compose,/coturn:\s+profiles: \["turn"\]/);
    assert.doesNotMatch(compose,/\$\{TURN_SECRET:\?/);
    assert.match(compose,/if \[ -z "\$\$TURN_SECRET" \]/);
});
test('both server entry points persist the database and room directory together', () => {
    assert.match(read('docker-compose.yml'),/DATABASE_URL=\/app\/persistence\/campaigns.db/);
    assert.match(read('docker-compose.yml'),/ROOM_DIRECTORY_FILE=\/app\/persistence\/room-directory.json/);
    assert.match(read('docker-compose.yml'),/server-persistence:\/app\/persistence/);
    assert.match(read(server+'docker-compose.yml'),/DATABASE_URL=\/app\/data\/campaigns.db/);
    assert.match(read(server+'docker-compose.yml'),/ROOM_DIRECTORY_FILE=\/app\/data\/room-directory.json/);
});
test('server build provides the native compilation fallback needed on some NAS CPUs', () => {
    assert.match(read(server+'Dockerfile'),/apk add[^\n]+python3 make g\+\+/);
    assert.match(read(server+'Dockerfile'),/ENTRYPOINT \["node", "server.js"\]/);
});

test('production output includes fetched content and seed assets, but not deployment secrets', async () => {
    const fixture = await mkdtemp(join(tmpdir(), 'fates-docker-test-'));
    try {
        await mkdir(join(fixture,'data/docs'), {recursive:true});
        await mkdir(join(fixture,'docs'));
        await writeFile(join(fixture,'data/docs/manifest.json'),'[]');
        await writeFile(join(fixture,'docs/example.html'),'<p>Help</p>');
        await writeFile(join(fixture,'.env'),'PRIVATE_TEST_SECRET=not-public');
        const plugin = staticDataPlugin(fixture);
        plugin.configResolved({command:'build',root:fixture,build:{outDir:'output'}});
        await plugin.closeBundle();
        assert.equal(await readFile(join(fixture,'output/data/docs/manifest.json'),'utf8'),'[]');
        assert.equal(await readFile(join(fixture,'output/docs/example.html'),'utf8'),'<p>Help</p>');
        const {seed} = JSON.parse(await readFile(join(fixture,'output/.seed/random-seed.json'),'utf8'));
        assert.match(seed,/^[a-f0-9]{64}$/);
        assert.equal(JSON.parse(await readFile(join(fixture,'output/data/seed.json'),'utf8')).seed,seed);
        assert.ok((await readFile(join(fixture,'output/seed.js'),'utf8')).includes(seed));
        await assert.rejects(access(join(fixture,'output/.env')));
    } finally { await rm(fixture,{recursive:true,force:true}); }
});
