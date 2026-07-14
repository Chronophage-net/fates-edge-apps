/**
 * Admin Commands
 */

const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('vttadmin')
        .setDescription('Admin commands for VTT bot')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('broadcast')
                .setDescription('Broadcast a message to all VTT clients')
                .addStringOption(option =>
                    option.setName('message')
                        .setDescription('Message to broadcast')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('sync')
                .setDescription('Force sync state')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('stats')
                .setDescription('Show bot statistics')
        ),

    async execute(interaction, client) {
        const subcommand = interaction.options.getSubcommand();

        await interaction.deferReply();

        try {
            switch (subcommand) {
                case 'broadcast':
                    await handleBroadcast(interaction, client);
                    break;
                case 'sync':
                    await handleSync(interaction, client);
                    break;
                case 'stats':
                    await handleStats(interaction, client);
                    break;
            }
        } catch (err) {
            await interaction.editReply(`❌ Error: ${err.message}`);
        }
    }
};

async function handleBroadcast(interaction, client) {
    const message = interaction.options.getString('message');

    if (!client.vtt.connected) {
        return interaction.editReply('❌ Not connected to VTT server.');
    }

    client.vtt.sendChatMessage(`📢 **Broadcast:** ${message}`, 'System');

    const embed = new EmbedBuilder()
        .setColor(0xd4af37)
        .setTitle('📢 Broadcast Sent')
        .setDescription(message)
        .setFooter({ text: `Sent by ${interaction.user.username}` })
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
}

async function handleSync(interaction, client) {
    if (!client.vtt.connected) {
        return interaction.editReply('❌ Not connected to VTT server.');
    }

    // Force re-sync of all data
    client.vtt.send('sync-state', { force: true });

    await interaction.editReply('✅ Sync request sent to VTT server.');
}

async function handleStats(interaction, client) {
    const embed = new EmbedBuilder()
        .setTitle('🤖 Bot Statistics')
        .setColor(0xd4af37)
        .addFields(
            { name: '🟢 VTT Status', value: client.vtt.connected ? 'Connected' : 'Disconnected', inline: true },
            { name: '📡 Server', value: client.vtt.config.serverUrl, inline: true },
            { name: '🏠 Room', value: client.vtt.roomCode || 'Not set', inline: true },
            { name: '🔄 Reconnect Attempts', value: String(client.vtt.reconnectAttempts), inline: true },
            { name: '📨 Pending Messages', value: String(client.vtt.pendingMessages.length), inline: true },
            { name: '👥 Characters', value: String(global.characters?.size || 0), inline: true },
            { name: '⏱️ Timers', value: String(global.timers?.size || 0), inline: true },
            { name: '📊 Uptime', value: getUptime(), inline: true }
        )
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
}

function getUptime() {
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);
    return `${hours}h ${minutes}m ${seconds}s`;
}
