/**
 * ready.js - Bot ready event
 * Sets up VTT event listeners for GM election/promotion notifications
 */

module.exports = {
    name: 'ready',
    once: true,
    execute(client) {
        console.log(`✅ Bot is online! Logged in as ${client.user.tag}`);

        // Set bot status
        client.user.setPresence({
            activities: [{ name: '/vtt help', type: 2 }],
            status: 'online'
        });

        // Set up VTT event listeners if available
        const vtt = client.vtt;
        if (!vtt) {
            console.warn('⚠️ VTT client not available, GM event listeners not registered');
            return;
        }

        // Helper to get log channel
        const getLogChannel = () => {
            // Prefer config, fallback to env
            const channelId = client.config?.vtt?.logChannel || process.env.VTT_LOG_CHANNEL;
            if (!channelId) {
                console.warn('⚠️ VTT_LOG_CHANNEL not set – GM notifications will not be sent');
                return null;
            }
            const channel = client.channels.cache.get(channelId);
            if (!channel) {
                console.warn(`⚠️ VTT log channel ${channelId} not found`);
                return null;
            }
            return channel;
        };

        // 1. GM vote request
        vtt.on('gmVoteRequest', (data) => {
            const channel = getLogChannel();
            if (!channel) return;
            const { requesterName, currentGmName } = data;
            channel.send({
                embeds: [{
                    color: 0xd4af37,
                    title: '👑 GM Vote Request',
                    description: `${requesterName} requests to become Game Master.`,
                    fields: [
                        { name: 'Current GM', value: currentGmName || 'None', inline: true },
                        { name: 'Requester', value: requesterName, inline: true }
                    ],
                    timestamp: new Date().toISOString(),
                    footer: { text: 'Use /vtt gm approve <name> to approve' }
                }]
            });
        });

        // 2. GM role update
        vtt.on('gmRoleUpdate', (data) => {
            const channel = getLogChannel();
            if (!channel) return;
            const { clientId, role } = data;
            // Get name from clients map if available
            const target = vtt.clients.get(clientId);
            const name = target ? (target.name || target.data?.name || clientId) : clientId;
            channel.send({
                embeds: [{
                    color: role === 'gm' ? 0x43b581 : 0xf04747,
                    title: '👑 GM Role Update',
                    description: `${name} is now **${role.toUpperCase()}**.`,
                    timestamp: new Date().toISOString()
                }]
            });
        });

        // 3. Server announcements (e.g., "GM has left", "new GM promoted")
        vtt.on('serverAnnouncement', (data) => {
            const channel = getLogChannel();
            if (!channel) return;
            const { message } = data;
            channel.send({
                embeds: [{
                    color: 0x5865f2,
                    title: '📢 Server Announcement',
                    description: message,
                    timestamp: new Date().toISOString()
                }]
            });
        });

        // Optional: log presence updates for debugging
        vtt.on('presence', (data) => {
            // Could log client count changes if needed
        });

        console.log('✅ VTT GM event listeners registered');
    }
};