/**
 * Admin Commands – VTT Management + Ban/Kick
 */

const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('vttadmin')
        .setDescription('Admin commands for VTT bot')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
        // Existing subcommands
        .addSubcommand(sub =>
            sub.setName('broadcast')
                .setDescription('Broadcast a message to all VTT clients')
                .addStringOption(opt =>
                    opt.setName('message')
                        .setDescription('Message to broadcast')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('sync')
                .setDescription('Force sync state')
        )
        .addSubcommand(sub =>
            sub.setName('stats')
                .setDescription('Show bot statistics')
        )
        .addSubcommand(sub =>
            sub.setName('deck')
                .setDescription('Manage VTT deck')
                .addStringOption(opt =>
                    opt.setName('action')
                        .setDescription('Action to perform')
                        .setRequired(true)
                        .addChoices(
                            { name: 'shuffle', value: 'shuffle' },
                            { name: 'clear-history', value: 'clear' },
                            { name: 'status', value: 'status' }
                        )
                )
        )
        .addSubcommand(sub =>
            sub.setName('modules')
                .setDescription('Manage VTT modules')
                .addStringOption(opt =>
                    opt.setName('action')
                        .setDescription('Action to perform')
                        .setRequired(true)
                        .addChoices(
                            { name: 'list', value: 'list' },
                            { name: 'push', value: 'push' },
                            { name: 'cleanup', value: 'cleanup' }
                        )
                )
                .addStringOption(opt =>
                    opt.setName('module-id')
                        .setDescription('Module ID (for push/cleanup)')
                        .setRequired(false)
                )
        )
        .addSubcommand(sub =>
            sub.setName('region')
                .setDescription('Set default region for deck draws')
                .addStringOption(opt =>
                    opt.setName('region')
                        .setDescription('Region name')
                        .setRequired(true)
                )
        )
        // ── New subcommands ──
        .addSubcommand(sub =>
            sub.setName('players')
                .setDescription('List players currently in the VTT room')
        )
        .addSubcommand(sub =>
            sub.setName('kick')
                .setDescription('Kick a player from the VTT room')
                .addStringOption(opt =>
                    opt.setName('target')
                        .setDescription('Player name or client ID')
                        .setRequired(true)
                )
                .addStringOption(opt =>
                    opt.setName('reason')
                        .setDescription('Reason for kick')
                        .setRequired(false)
                )
        )
        .addSubcommand(sub =>
            sub.setName('ban')
                .setDescription('Ban a player from the VTT room')
                .addStringOption(opt =>
                    opt.setName('target')
                        .setDescription('Player name or client ID')
                        .setRequired(true)
                )
                .addStringOption(opt =>
                    opt.setName('reason')
                        .setDescription('Reason for ban')
                        .setRequired(false)
                )
        )
        .addSubcommand(sub =>
            sub.setName('unban')
                .setDescription('Unban a client')
                .addStringOption(opt =>
                    opt.setName('client-id')
                        .setDescription('The client ID to unban')
                        .setRequired(true)
                )
        ),

    async execute(interaction, client) {
        const subcommand = interaction.options.getSubcommand();

        await interaction.deferReply();

        try {
            switch (subcommand) {
                case 'broadcast':   return handleBroadcast(interaction, client);
                case 'sync':        return handleSync(interaction, client);
                case 'stats':       return handleStats(interaction, client);
                case 'deck':        return handleDeck(interaction, client);
                case 'modules':     return handleModules(interaction, client);
                case 'region':      return handleRegion(interaction, client);
                case 'players':     return handlePlayers(interaction, client);
                case 'kick':        return handleKick(interaction, client);
                case 'ban':         return handleBan(interaction, client);
                case 'unban':       return handleUnban(interaction, client);
            }
        } catch (err) {
            await interaction.editReply(`❌ Error: ${err.message}`);
        }
    }
};

// ─── Existing handlers ──────────────────────────────────────

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

// ─── New handlers ───────────────────────────────────────────

function getPlayerList(client) {
    if (!client.vtt.clients || client.vtt.clients.size === 0) {
        return 'No players currently in the room.';
    }
    const entries = [];
    for (const [id, info] of client.vtt.clients) {
        entries.push(`\`${id}\` – **${info.name}** (${info.role})`);
    }
    return entries.join('\n');
}

async function handlePlayers(interaction, client) {
    if (!client.vtt.connected) {
        return interaction.editReply('❌ Not connected to VTT server.');
    }
    const list = getPlayerList(client);
    const embed = new EmbedBuilder()
        .setColor(0xd4af37)
        .setTitle('👥 Players in Room')
        .setDescription(list)
        .setTimestamp();
    await interaction.editReply({ embeds: [embed] });
}

async function resolveTarget(client, target) {
    // If target looks like a client ID (ws-... or socket.io id), use it directly
    if (target.startsWith('ws-') || target.length === 20) {
        return target;
    }
    // Otherwise, search by name
    if (!client.vtt.clients || client.vtt.clients.size === 0) {
        throw new Error('No player data available. Cannot resolve name.');
    }
    const id = client.vtt.getClientIdByName(target);
    if (!id) throw new Error(`Player "${target}" not found.`);
    return id;
}

async function handleKick(interaction, client) {
    if (!client.vtt.connected) {
        return interaction.editReply('❌ Not connected to VTT server.');
    }
    const target = interaction.options.getString('target');
    const reason = interaction.options.getString('reason') || 'Kicked by admin';
    let clientId;
    try {
        clientId = await resolveTarget(client, target);
    } catch (e) {
        return interaction.editReply(`❌ ${e.message}`);
    }
    client.vtt.send('kick_client', { targetId: clientId, reason });
    await interaction.editReply(`👢 Kicked \`${clientId}\` (Reason: ${reason})`);
}

async function handleBan(interaction, client) {
    if (!client.vtt.connected) {
        return interaction.editReply('❌ Not connected to VTT server.');
    }
    const target = interaction.options.getString('target');
    const reason = interaction.options.getString('reason') || 'Banned by admin';
    let clientId;
    try {
        clientId = await resolveTarget(client, target);
    } catch (e) {
        return interaction.editReply(`❌ ${e.message}`);
    }
    client.vtt.send('ban_client', { targetId: clientId, reason });
    await interaction.editReply(`🚫 Banned \`${clientId}\` (Reason: ${reason})`);
}

async function handleUnban(interaction, client) {
    if (!client.vtt.connected) {
        return interaction.editReply('❌ Not connected to VTT server.');
    }
    const clientId = interaction.options.getString('client-id');
    client.vtt.send('unban_client', { targetId: clientId });
    await interaction.editReply(`✅ Unbanned \`${clientId}\`.`);
}

// ─── Helpers ─────────────────────────────────────────────────

function getUptime() {
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);
    return `${hours}h ${minutes}m ${seconds}s`;
}