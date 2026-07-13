import { describe, it, assert, assertEqual, assertDeepEqual, assertTrue } from '../runner.js';
import { OfflineQueue } from '../../core/sync/offline-queue.js';

describe('OfflineQueue', () => {
    
    it('should create a queue', () => {
        const queue = new OfflineQueue();
        assert(queue);
        assertEqual(queue.size(), 0);
    });
    
    it('should enqueue items', async () => {
        const queue = new OfflineQueue();
        await queue.enqueue({ type: 'test', data: 'hello' });
        assertEqual(queue.size(), 1);
    });
    
    it('should flush pending items', async () => {
        const queue = new OfflineQueue();
        await queue.enqueue({ type: 'test1', data: 'hello' });
        await queue.enqueue({ type: 'test2', data: 'world' });
        
        let sent = [];
        await queue.flush((item) => {
            sent.push(item);
            return Promise.resolve();
        });
        
        assertEqual(sent.length, 2);
        assertEqual(sent[0].type, 'test1');
        assertEqual(sent[1].type, 'test2');
        assertEqual(queue.size(), 0);
    });
    
    it('should clear the queue', async () => {
        const queue = new OfflineQueue();
        await queue.enqueue({ type: 'test' });
        queue.clear();
        assertEqual(queue.size(), 0);
    });
});
