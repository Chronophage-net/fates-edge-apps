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
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('deck')
                .setDescription('Manage VTT deck')
                .addStringOption(option =>
                    option.setName('action')
                        .setDescription('Action to perform')
                        .setRequired(true)
                        .addChoices(
                            { name: 'shuffle', value: 'shuffle' },
                            { name: 'clear-history', value: 'clear' },
                            { name: 'status', value: 'status' }
                        )
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('modules')
                .setDescription('Manage VTT modules')
                .addStringOption(option =>
                    option.setName('action')
                        .setDescription('Action to perform')
                        .setRequired(true)
                        .addChoices(
                            { name: 'list', value: 'list' },
                            { name: 'push', value: 'push' },
                            { name: 'cleanup', value: 'cleanup' }
                        )
                )
                .addStringOption(option =>
                    option.setName('module-id')
                        .setDescription('Module ID (for push/cleanup)')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('region')
                .setDescription('Set default region for deck draws')
                .addStringOption(option =>
                    option.setName('region')
                        .setDescription('Region name')
                        .setRequired(true)
                )
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
                case 'deck':
                    await handleDeck(interaction, client);
                    break;
                case 'modules':
                    await handleModules(interaction, client);
                    break;
                case 'region':
                    await handleRegion(interaction, client);
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

    client.vtt.send('sync-state', { force: true });

    await interaction.editReply('✅ Sync request sent to VTT server.');
}

async function handleStats(interaction, client) {
    const deckState = client.vtt.deck || { cards: [], history: [] };
    const modules = client.vtt.modules || [];
    const region = client.vtt.defaultRegion || 'Acasia';
    
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
            { name: '🃏 Deck Cards', value: String(deckState.cards?.length || 0), inline: true },
            { name: '📜 Deck History', value: String(deckState.history?.length || 0), inline: true },
            { name: '📍 Default Region', value: region, inline: true },
            { name: '📦 Modules Loaded', value: String(modules.length), inline: true },
            { name: '📊 Uptime', value: getUptime(), inline: true }
        )
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
}

async function handleDeck(interaction, client) {
    const action = interaction.options.getString('action');

    if (!client.vtt.connected) {
        return interaction.editReply('❌ Not connected to VTT server.');
    }

    switch (action) {
        case 'shuffle':
            client.vtt.send('deck-shuffle', {});
            await interaction.editReply('🔀 Deck shuffle requested.');
            break;
        case 'clear':
            client.vtt.send('deck-clear-history', {});
            await interaction.editReply('🗑️ Deck history cleared.');
            break;
        case 'status':
            const deckState = client.vtt.deck || { cards: [], history: [] };
            const embed = new EmbedBuilder()
                .setColor(0xd4af37)
                .setTitle('🃏 Deck Status')
                .addFields(
                    { name: 'Cards Remaining', value: String(deckState.cards?.length || 0), inline: true },
                    { name: 'History Entries', value: String(deckState.history?.length || 0), inline: true }
                )
                .setTimestamp();
            await interaction.editReply({ embeds: [embed] });
            break;
    }
}

async function handleModules(interaction, client) {
    const action = interaction.options.getString('action');
    const moduleId = interaction.options.getString('module-id');

    if (!client.vtt.connected) {
        return interaction.editReply('❌ Not connected to VTT server.');
    }

    switch (action) {
        case 'list':
            client.vtt.send('module-list', {});
            const embed = new EmbedBuilder()
                .setColor(0xd4af37)
                .setTitle('📦 Modules')
                .setDescription('Requested module list from VTT server.')
                .setTimestamp();
            await interaction.editReply({ embeds: [embed] });
            break;
        case 'push':
            if (!moduleId) {
                return interaction.editReply('❌ Please provide a module ID.');
            }
            client.vtt.send('module-push', { moduleId });
            await interaction.editReply(`📦 Push requested for module: ${moduleId}`);
            break;
        case 'cleanup':
            if (!moduleId) {
                return interaction.editReply('❌ Please provide a module ID.');
            }
            client.vtt.send('module-cleanup', { moduleId });
            await interaction.editReply(`🧹 Cleanup requested for module: ${moduleId}`);
            break;
    }
}

async function handleRegion(interaction, client) {
    const region = interaction.options.getString('region');
    client.vtt.defaultRegion = region;
    client.vtt.send('set-region', { region });
    await interaction.editReply(`📍 Default region set to: ${region}`);
}

function getUptime() {
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);
    return `${hours}h ${minutes}m ${seconds}s`;
}