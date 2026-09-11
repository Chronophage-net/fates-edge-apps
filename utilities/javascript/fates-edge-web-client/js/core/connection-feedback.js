/** Shared, actionable admission feedback for both connection transports. */
const messages = {
    JOIN_IN_PROGRESS: 'A room join is already in progress. Wait for its result before retrying.',
    ROOM_JOIN_FAILED: 'The room could not be joined. Try again or contact the host.',
    ROOM_CODE_INVALID: 'Check the campaign code supplied by your host, then try again.',
    ROOM_PASSWORD_INVALID: 'That room password was not accepted. Check it with your host and try again.',
    ROOM_INVITATION_REQUIRED: 'Ask the host for an invitation to this side task, then try again.',
    MANAGED_ACCESS_REJECTED: 'Get a fresh room connection from the manager and paste it again.',
    ROOM_FULL: 'This room is full. Ask the host to free a seat before retrying.',
    ROOM_BANNED: 'Access to this room is blocked. Contact the host before trying again.',
};
export function connectionFeedback(error, fallback = 'Connection failed. Check the server address and your network, then try again.') {
    const detail = error?.error || error;
    return messages[detail?.code] || detail?.message || (typeof detail === 'string' ? detail : fallback);
}
