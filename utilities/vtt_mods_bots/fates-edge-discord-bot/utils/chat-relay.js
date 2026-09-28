// A shared Discord channel must never receive a VTT whisper.
function publicChat(data, ownClientId) {
    const message = data?.message || data;
    if (!message || message.senderClientId === ownClientId || message.whisper || message.privateOnly ||
        (message.recipient && message.recipient !== 'all') || typeof message.text !== 'string') return null;
    return { content: `${message.sender || 'VTT'}: ${message.text}`.slice(0, 2000), allowedMentions: { parse: [] } };
}
module.exports = { publicChat };
