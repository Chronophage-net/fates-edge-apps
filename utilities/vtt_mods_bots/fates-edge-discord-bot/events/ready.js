/**
 * ready.js - Bot ready event
 * Sets up VTT event listeners for GM election/promotion notifications
 */

const ttsVoice = require('../utils/tts-voice');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// Suggestion id -> the Discord message posted for it, so
// assistantSuggestionResolved can edit that same message in place
// (buttons disabled, outcome shown) instead of posting a second message.
// Module-level and process-lifetime only, same posture as
// assistant-suggestions.js's own in-memory queue on the bot side -- a
// suggestion still pending across a Discord bot restart just won't have
// its original message editable, which is an acceptable loss (the queue
// itself lives in the AI GM Bot process, not here).
const assistantSuggestionMessages = new Map();

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

        // 2b. v4.8: Co-GM / Player / Spectator role update. Distinct from
        // 'gmRoleUpdate' above (the single GM seat) -- see websocket.js's
        // 'role_update' case for why these are separate events.
        vtt.on('roleUpdate', (data) => {
            const channel = getLogChannel();
            if (!channel) return;
            const { targetId, role, persist } = data;
            const target = vtt.clients.get(targetId);
            const name = target ? (target.name || target.data?.name || targetId) : targetId;
            const roleColors = { 'co-gm': 0xf0a500, player: 0x43b581, spectator: 0x7289da };
            const roleLabels = { 'co-gm': 'Co-GM', player: 'Player', spectator: 'Spectator' };
            channel.send({
                embeds: [{
                    color: roleColors[role] ?? 0x43b581,
                    title: '🎭 Role Update',
                    description: `${name} is now **${roleLabels[role] || role}**${role === 'co-gm' ? (persist ? ' (saved)' : ' (this session only)') : ''}.`,
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

        // NEW: optional AI GM voice narration (see utils/tts-voice.js
        // and DISCORD_TTS_ENABLED/DISCORD_TTS_VOICE_CHANNEL_ID). A
        // silent no-op when not configured -- see that module's own
        // header comment.
        vtt.on('tts-audio', (data) => {
            ttsVoice.playNarration(client, data).catch(e => {
                console.warn('⚠️ AI GM voice narration playback error:', e.message);
            });
        });

        // NEW: optional Reactive Soundscape (see the AI GM Bot's
        // adventure-context.js mood -> trackId profile, and its newer
        // SOUNDSCAPE_AUTO_SEARCH fallback). Posts a "now playing" embed
        // to the VTT log channel when ambience changes -- no voice
        // playback here, the actual audio plays client-side in each
        // connected web browser (see that repo's js/core/soundboard.js).
        // A silent no-op if VTT_LOG_CHANNEL isn't configured, same as
        // every other getLogChannel()-gated listener above.
        vtt.on('soundboard-ambience', (data) => {
            const channel = getLogChannel();
            if (!channel) return;
            const { mood, trackId, url, name, attribution, transitionDuration } = data || {};
            if (!mood && !trackId && !url) return;
            const fields = [];
            if (trackId) {
                fields.push({ name: 'Track', value: trackId, inline: true });
            } else if (url) {
                // SOUNDSCAPE_AUTO_SEARCH result -- no pre-existing trackId,
                // just the Freesound preview URL the bot picked.
                fields.push({ name: 'Sound', value: name ? `${name} (auto-searched)` : 'Auto-searched', inline: true });
                if (attribution) {
                    fields.push({ name: 'Attribution', value: `${attribution.author} — ${attribution.license}`, inline: true });
                }
            }
            channel.send({
                embeds: [{
                    color: 0x9b59b6,
                    title: '🎵 Now Playing',
                    description: mood
                        ? `Ambience shifting to **${mood}**.`
                        : 'Ambience shifting.',
                    url: url || undefined,
                    fields,
                    footer: transitionDuration ? { text: `Crossfading over ${transitionDuration}ms` } : undefined,
                    timestamp: new Date().toISOString()
                }]
            });
        });

        // NEW: Assistant GM suggestion queue (optional -- see the AI GM
        // Bot's modules/assistant-suggestions.js and ROADMAP.md item 2 in
        // that repo, and utils/websocket.js's matching case comment).
        // Posted to the VTT log channel as an embed with live Approve/
        // Reject buttons; see events/interactionCreate.js for the button
        // handler that turns a click back into the existing `!gm
        // approve/reject <id>` chat command. A silent no-op if
        // VTT_LOG_CHANNEL isn't configured, same as every other
        // getLogChannel()-gated listener above.
        vtt.on('assistantSuggestionCreated', async (data) => {
            const channel = getLogChannel();
            if (!channel) return;
            const { id, kind, label, preview } = data || {};
            if (!id) return;
            const embed = new EmbedBuilder()
                .setColor(0xf1c40f)
                .setTitle('📋 Assistant GM Proposal')
                .setDescription(preview || label || kind || '(no description)')
                .addFields({ name: 'Kind', value: kind || 'suggestion', inline: true })
                .setFooter({ text: `id: ${id}` })
                .setTimestamp();
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`assistant_suggestion:approve:${id}`).setLabel('✅ Approve').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`assistant_suggestion:reject:${id}`).setLabel('🗑️ Reject').setStyle(ButtonStyle.Danger)
            );
            try {
                const sent = await channel.send({ embeds: [embed], components: [row] });
                assistantSuggestionMessages.set(id, sent);
            } catch (e) {
                console.warn('⚠️ Failed to post Assistant GM suggestion embed:', e.message);
            }
        });

        vtt.on('assistantSuggestionResolved', async (data) => {
            const { id, outcome } = data || {};
            if (!id) return;
            const sent = assistantSuggestionMessages.get(id);
            assistantSuggestionMessages.delete(id);
            if (!sent) return; // this Discord bot process didn't post it (or restarted) -- nothing to edit
            const outcomeLabel = { approved: '✅ Approved', rejected: '🗑️ Rejected', 'auto-rejected': '🗑️ Auto-rejected (another option was approved)' }[outcome] || outcome;
            try {
                const original = sent.embeds[0];
                const embed = EmbedBuilder.from(original).setColor(outcome === 'approved' ? 0x43b581 : 0x99aab5).addFields({ name: 'Outcome', value: outcomeLabel });
                await sent.edit({ embeds: [embed], components: [] });
            } catch (e) {
                console.warn('⚠️ Failed to update Assistant GM suggestion embed:', e.message);
            }
        });

        console.log('✅ VTT GM event listeners registered');
    }
};