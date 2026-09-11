import { describe, it, assertEqual, assertTrue } from '../runner.js';
import { connectionFeedback } from '../../js/core/connection-feedback.js';
describe('Connection recovery feedback', () => {
    it('handles both direct transport errors and wrapped errors', () => {
        const error = { code: 'ROOM_PASSWORD_INVALID', message: 'old message' };
        assertEqual(connectionFeedback(error), connectionFeedback({ error }));
        assertTrue(connectionFeedback(error).includes('host'));
    });
    it('offers fresh credentials for managed access without echoing a credential', () => {
        const text = connectionFeedback({ code: 'MANAGED_ACCESS_REJECTED', message: 'private token' });
        assertTrue(text.includes('fresh'));
        assertTrue(!text.includes('private token'));
    });
    it('keeps older server messages and supplies a network fallback', () => {
        assertEqual(connectionFeedback(new Error('Legacy server error')), 'Legacy server error');
        assertTrue(connectionFeedback(null).includes('network'));
    });
});
