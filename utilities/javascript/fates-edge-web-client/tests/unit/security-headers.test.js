import { readFileSync } from 'node:fs';
import { describe, it, assert } from '../runner.js';

describe('Deployment security headers', () => {
    it('keeps protection in every nginx block that overrides header inheritance', () => {
        const config = readFileSync(new URL('../../nginx.conf', import.meta.url), 'utf8');
        const blocks = [{ name: 'root', headers: [] }];
        for (const raw of config.split('\n')) {
            const line = raw.trim();
            if (!line || line.startsWith('#')) continue;
            if (line.endsWith('{')) blocks.push({ name: line, headers: [] });
            else if (line === '}') {
                const block = blocks.pop();
                if (block.headers.length) {
                    for (const name of ['X-Frame-Options', 'X-Content-Type-Options', 'Referrer-Policy']) {
                        assert(block.headers.some(header => header.startsWith(`add_header ${name} `) && header.endsWith('always;')),
                            `${block.name} overrides inherited ${name}`);
                    }
                }
            } else if (line.startsWith('add_header ')) blocks[blocks.length - 1].headers.push(line);
        }
        assert(blocks.length === 1, 'configuration blocks balance');
    });
});
