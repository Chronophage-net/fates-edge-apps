/**
 * Admin Commands – VTT Management + Ban/Kick + Characters + Grid + Whiteboard
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
        // ── Player management (existing) ──
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
        )
        // ── NEW: Characters ──
        .addSubcommand(sub =>
            sub.setName('characters')
                .setDescription('Manage VTT characters')
                .addStringOption(opt =>
                    opt.setName('action')
                        .setDescription('Action to perform')
                        .setRequired(true)
                        .addChoices(
                            { name: 'list', value: 'list' },
                            { name: 'view', value: 'view' },
                            { name: 'update', value: 'update' },
                            { name: 'sync', value: 'sync' }
                        )
                )
                .addStringOption(opt =>
                    opt.setName('name')
                        .setDescription('Character name (for view/update)')
                        .setRequired(false)
                )
                .addStringOption(opt =>
                    opt.setName('field')
                        .setDescription('Field to update (for update action)')
                        .setRequired(false)
                )
                .addStringOption(opt =>
                    opt.setName('value')
                        .setDescription('Value to set (for update action)')
                        .setRequired(false)
                )
        )
        // ── NEW: Grid Combat ──
        .addSubcommand(sub =>
            sub.setName('grid')
                .setDescription('Manage grid combat')
                .addStringOption(opt =>
                    opt.setName('action')
                        .setDescription('Action to perform')
                        .setRequired(true)
                        .addChoices(
                            { name: 'status', value: 'status' },
                            { name: 'enable', value: 'enable' },
                            { name: 'disable', value: 'disable' }
                        )
                )
        )
        .addSubcommand(sub =>
            sub.setName('token')
                .setDescription('Manage tokens on the grid')
                .addStringOption(opt =>
                    opt.setName('action')
                        .setDescription('Action to perform')
                        .setRequired(true)
                        .addChoices(
                            { name: 'list', value: 'list' },
                            { name: 'add', value: 'add' },
                            { name: 'remove', value: 'remove' },
                            { name: 'move', value: 'move' }
                        )
                )
                .addStringOption(opt =>
                    opt.setName('name')
                        .setDescription('Token name (for add)')
                        .setRequired(false)
                )
                .addStringOption(opt =>
                    opt.setName('x')
                        .setDescription('X position (for add/move)')
                        .setRequired(false)
                )
                .addStringOption(opt =>
                    opt.setName('y')
                        .setDescription('Y position (for add/move)')
                        .setRequired(false)
                )
                .addStringOption(opt =>
                    opt.setName('color')
                        .setDescription('Color hex (for add)')
                        .setRequired(false)
                )
                .addStringOption(opt =>
                    opt.setName('token-id')
                        .setDescription('Token ID (for remove/move)')
                        .setRequired(false)
                )
        )
        // ── NEW: Whiteboard ──
        .addSubcommand(sub =>
            sub.setName('whiteboard')
                .setDescription('Manage whiteboard')
                .addStringOption(opt =>
                    opt.setName('action')
                        .setDescription('Action to perform')
                        .setRequired(true)
                        .addChoices(
                            { name: 'status', value: 'status' },
                            { name: 'sync', value: 'sync' }
                        )
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
                case 'characters':  return handleCharacters(interaction, client);
                case 'grid':        return handleGrid(interaction, client);
                case 'token':       return handleToken(interaction, client);
                case 'whiteboard':  return handleWhiteboard(interaction, client);
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
    client.vtt.send('sync-request', {});
    await interaction.editReply('✅ Sync request sent to VTT server.');
}

async function handleStats(interaction, client) {
    const deckState = client.vtt.deck || { cards: [], history: [] };
    const modules = client.vtt.modules || [];
    const region = client.vtt.defaultRegion || 'Acasia';
    const charCount = client.vtt.characters ? Object.keys(client.vtt.characters).length : 0;
    const embed = new EmbedBuilder()
        .setTitle('🤖 Bot Statistics')
        .setColor(0xd4af37)
        .addFields(
            { name: '🟢 VTT Status', value: client.vtt.connected ? 'Connected' : 'Disconnected', inline: true },
            { name: '📡 Server', value: client.vtt.config.serverUrl, inline: true },
            { name: '🏠 Room', value: client.vtt.roomCode || 'Not set', inline: true },
            { name: '🔄 Reconnect Attempts', value: String(client.vtt.reconnectAttempts), inline: true },
            { name: '📨 Pending Messages', value: String(client.vtt.pendingMessages?.length || 0), inline: true },
            { name: '👥 Characters', value: String(charCount), inline: true },
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
            client.vtt.send('deck-history-clear', {});
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
            client.vtt.send('module-push-request', { moduleId });
            await interaction.editReply(`📦 Push requested for module: ${moduleId}`);
            break;
        case 'cleanup':
            if (!moduleId) {
                return interaction.editReply('❌ Please provide a module ID.');
            }
            client.vtt.send('module-cleanup-request', { moduleId });
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

// ─── Player management ───────────────────────────────────

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
    // Use the new helper from vtt client if available
    if (typeof client.vtt.getClientIdByName === 'function') {
        const id = client.vtt.getClientIdByName(target);
        if (id) return id;
    } else {
        // Manual search
        for (const [id, info] of client.vtt.clients) {
            if (info.name.toLowerCase() === target.toLowerCase()) {
                return id;
            }
        }
    }
    throw new Error(`Player "${target}" not found.`);
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

// ─── NEW: Characters ──────────────────────────────────────

async function handleCharacters(interaction, client) {
    const action = interaction.options.getString('action');
    const name = interaction.options.getString('name');
    const field = interaction.options.getString('field');
    const value = interaction.options.getString('value');

    if (!client.vtt.connected) {
        return interaction.editReply('❌ Not connected to VTT server.');
    }

    const apiBase = client.vtt.getApiBaseUrl ? client.vtt.getApiBaseUrl() : `${client.vtt.config.serverUrl.replace('ws', 'http')}/api`;
    const apiKey = process.env.API_KEY || client.vtt.config.apiKey || '';

    async function apiRequest(endpoint, method = 'GET', data = null) {
        const url = `${apiBase}${endpoint}`;
        const headers = { 'Content-Type': 'application/json' };
        if (apiKey) headers['x-api-key'] = apiKey;
        const options = { method, headers };
        if (data && method !== 'GET') options.body = JSON.stringify(data);
        const res = await fetch(url, options);
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`HTTP ${res.status}: ${text}`);
        }
        return res.json();
    }

    try {
        switch (action) {
            case 'list': {
                const result = await apiRequest(`/rooms/${client.vtt.roomCode}/characters`);
                const chars = result.characters || [];
                if (chars.length === 0) {
                    return interaction.editReply('No characters found in the room.');
                }
                const embed = new EmbedBuilder()
                    .setColor(0xd4af37)
                    .setTitle(`👤 Characters (${chars.length})`)
                    .setDescription(chars.map(c => `**${c.name}** — ❤️${c.harm || 0} ⚡${c.fatigue || 0} 🎲${c.boons || 0}`).join('\n'))
                    .setTimestamp();
                await interaction.editReply({ embeds: [embed] });
                break;
            }
            case 'view': {
                if (!name) return interaction.editReply('❌ Please provide a character name with `name` option.');
                const result = await apiRequest(`/rooms/${client.vtt.roomCode}/characters/${encodeURIComponent(name)}`);
                const embed = new EmbedBuilder()
                    .setColor(0xd4af37)
                    .setTitle(`👤 ${result.name}`)
                    .setDescription(`\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``)
                    .setTimestamp();
                await interaction.editReply({ embeds: [embed] });
                break;
            }
            case 'update': {
                if (!name || !field || value === null) {
                    return interaction.editReply('❌ Usage: /vttadmin characters update <name> <field> <value>');
                }
                const updates = { [field]: value };
                await apiRequest(`/rooms/${client.vtt.roomCode}/characters/update`, 'POST', { updates: { [name]: updates } });
                await interaction.editReply(`✅ Updated \`${name}\`.\`${field}\` = \`${value}\``);
                break;
            }
            case 'sync':
                client.vtt.send('sync-request', { entity: 'characters' });
                await interaction.editReply('✅ Character sync requested.');
                break;
        }
    } catch (err) {
        await interaction.editReply(`❌ Character operation failed: ${err.message}`);
    }
}

// ─── NEW: Grid Combat ────────────────────────────────────

async function handleGrid(interaction, client) {
    const action = interaction.options.getString('action');
    if (!client.vtt.connected) {
        return interaction.editReply('❌ Not connected to VTT server.');
    }

    const apiBase = client.vtt.getApiBaseUrl ? client.vtt.getApiBaseUrl() : `${client.vtt.config.serverUrl.replace('ws', 'http')}/api`;
    const apiKey = process.env.API_KEY || client.vtt.config.apiKey || '';

    async function apiRequest(endpoint, method = 'GET', data = null) {
        const url = `${apiBase}${endpoint}`;
        const headers = { 'Content-Type': 'application/json' };
        if (apiKey) headers['x-api-key'] = apiKey;
        const options = { method, headers };
        if (data && method !== 'GET') options.body = JSON.stringify(data);
        const res = await fetch(url, options);
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`HTTP ${res.status}: ${text}`);
        }
        return res.json();
    }

    try {
        switch (action) {
            case 'status': {
                const wb = await apiRequest(`/rooms/${client.vtt.roomCode}/whiteboard`);
                const gc = wb.gridCombat || {};
                const embed = new EmbedBuilder()
                    .setColor(0xd4af37)
                    .setTitle('⚔️ Grid Combat Status')
                    .addFields(
                        { name: 'Enabled', value: gc.enabled ? '✅' : '❌', inline: true },
                        { name: 'Grid Type', value: gc.gridType || 'square', inline: true },
                        { name: 'Cell Size', value: String(gc.cellSize || 40), inline: true },
                        { name: 'Tokens', value: String(gc.tokens?.length || 0), inline: true },
                        { name: 'Show Coordinates', value: gc.showCoordinates ? '✅' : '❌', inline: true },
                        { name: 'Show Zones', value: gc.showZones ? '✅' : '❌', inline: true }
                    )
                    .setTimestamp();
                await interaction.editReply({ embeds: [embed] });
                break;
            }
            case 'enable': {
                await apiRequest(`/rooms/${client.vtt.roomCode}/grid-combat`, 'POST', { enabled: true });
                await interaction.editReply('✅ Grid combat enabled.');
                break;
            }
            case 'disable': {
                await apiRequest(`/rooms/${client.vtt.roomCode}/grid-combat`, 'POST', { enabled: false });
                await interaction.editReply('❌ Grid combat disabled.');
                break;
            }
        }
    } catch (err) {
        await interaction.editReply(`❌ Grid operation failed: ${err.message}`);
    }
}

// ─── NEW: Tokens ────────────────────────────────────────

async function handleToken(interaction, client) {
    const action = interaction.options.getString('action');
    if (!client.vtt.connected) {
        return interaction.editReply('❌ Not connected to VTT server.');
    }

    const apiBase = client.vtt.getApiBaseUrl ? client.vtt.getApiBaseUrl() : `${client.vtt.config.serverUrl.replace('ws', 'http')}/api`;
    const apiKey = process.env.API_KEY || client.vtt.config.apiKey || '';

    async function apiRequest(endpoint, method = 'GET', data = null) {
        const url = `${apiBase}${endpoint}`;
        const headers = { 'Content-Type': 'application/json' };
        if (apiKey) headers['x-api-key'] = apiKey;
        const options = { method, headers };
        if (data && method !== 'GET') options.body = JSON.stringify(data);
        const res = await fetch(url, options);
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`HTTP ${res.status}: ${text}`);
        }
        return res.json();
    }

    try {
        switch (action) {
            case 'list': {
                const result = await apiRequest(`/rooms/${client.vtt.roomCode}/tokens`);
                const tokens = result.tokens || [];
                if (tokens.length === 0) {
                    return interaction.editReply('No tokens on the grid.');
                }
                const embed = new EmbedBuilder()
                    .setColor(0xd4af37)
                    .setTitle(`🎯 Tokens (${tokens.length})`)
                    .setDescription(tokens.map(t => `**${t.name}** (ID: \`${t.id}\`) — (${t.x}, ${t.y}) ${t.color}`).join('\n'))
                    .setTimestamp();
                await interaction.editReply({ embeds: [embed] });
                break;
            }
            case 'add': {
                const name = interaction.options.getString('name');
                const x = parseInt(interaction.options.getString('x')) || 0;
                const y = parseInt(interaction.options.getString('y')) || 0;
                const color = interaction.options.getString('color') || '#d4af37';
                if (!name) return interaction.editReply('❌ Please provide a token name.');
                const result = await apiRequest(`/rooms/${client.vtt.roomCode}/tokens`, 'POST', { name, x, y, color });
                await interaction.editReply(`✅ Token "${name}" added with ID: \`${result.id}\``);
                break;
            }
            case 'remove': {
                const tokenId = interaction.options.getString('token-id');
                if (!tokenId) return interaction.editReply('❌ Please provide a token ID.');
                await apiRequest(`/rooms/${client.vtt.roomCode}/tokens/${tokenId}`, 'DELETE');
                await interaction.editReply(`✅ Token \`${tokenId}\` removed.`);
                break;
            }
            case 'move': {
                const tokenId = interaction.options.getString('token-id');
                const x = parseInt(interaction.options.getString('x'));
                const y = parseInt(interaction.options.getString('y'));
                if (!tokenId || isNaN(x) || isNaN(y)) {
                    return interaction.editReply('❌ Usage: /vttadmin token move <token-id> <x> <y>');
                }
                await apiRequest(`/rooms/${client.vtt.roomCode}/tokens/${tokenId}/move`, 'POST', { x, y });
                await interaction.editReply(`✅ Token \`${tokenId}\` moved to (${x}, ${y}).`);
                break;
            }
        }
    } catch (err) {
        await interaction.editReply(`❌ Token operation failed: ${err.message}`);
    }
}

// ─── NEW: Whiteboard ─────────────────────────────────────

async function handleWhiteboard(interaction, client) {
    const action = interaction.options.getString('action');
    if (!client.vtt.connected) {
        return interaction.editReply('❌ Not connected to VTT server.');
    }

    const apiBase = client.vtt.getApiBaseUrl ? client.vtt.getApiBaseUrl() : `${client.vtt.config.serverUrl.replace('ws', 'http')}/api`;
    const apiKey = process.env.API_KEY || client.vtt.config.apiKey || '';

    async function apiRequest(endpoint, method = 'GET', data = null) {
        const url = `${apiBase}${endpoint}`;
        const headers = { 'Content-Type': 'application/json' };
        if (apiKey) headers['x-api-key'] = apiKey;
        const options = { method, headers };
        if (data && method !== 'GET') options.body = JSON.stringify(data);
        const res = await fetch(url, options);
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`HTTP ${res.status}: ${text}`);
        }
        return res.json();
    }

    try {
        switch (action) {
            case 'status': {
                const wb = await apiRequest(`/rooms/${client.vtt.roomCode}/whiteboard`);
                const embed = new EmbedBuilder()
                    .setColor(0xd4af37)
                    .setTitle('📋 Whiteboard Status')
                    .addFields(
                        { name: 'Drawings', value: String(wb.drawings?.length || 0), inline: true },
                        { name: 'Notes', value: String(wb.notes?.length || 0), inline: true },
                        { name: 'Images', value: String(wb.images?.length || 0), inline: true }
                    )
                    .setTimestamp();
                if (wb.gridCombat) {
                    embed.addFields(
                        { name: 'Grid Combat', value: wb.gridCombat.enabled ? '✅' : '❌', inline: true },
                        { name: 'Tokens', value: String(wb.gridCombat.tokens?.length || 0), inline: true }
                    );
                }
                await interaction.editReply({ embeds: [embed] });
                break;
            }
            case 'sync':
                client.vtt.send('sync-request', { entity: 'whiteboard' });
                await interaction.editReply('✅ Whiteboard sync requested.');
                break;
        }
    } catch (err) {
        await interaction.editReply(`❌ Whiteboard operation failed: ${err.message}`);
    }
}

// ─── Helpers ─────────────────────────────────────────────────

function getUptime() {
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);
    return `${hours}h ${minutes}m ${seconds}s`;
}