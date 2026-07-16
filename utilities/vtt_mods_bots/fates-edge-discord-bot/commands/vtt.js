/**
 * VTT Commands - Connect, status, disconnect
 * Updated for v1.2.0 with deck, module, region, and GM support
 */

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('vtt')
        .setDescription('Manage VTT connection')
        .addSubcommand(subcommand =>
            subcommand
                .setName('connect')
                .setDescription('Connect to the VTT server')
                .addStringOption(option =>
                    option.setName('room')
                        .setDescription('Room code to join')
                        .setRequired(false)
                )
                .addStringOption(option =>
                    option.setName('server')
                        .setDescription('Server URL (overrides config)')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('disconnect')
                .setDescription('Disconnect from the VTT server')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('Show VTT connection status')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('info')
                .setDescription('Show room information')
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
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('modules')
                .setDescription('List loaded modules')
        )
        // GM subcommand group
        .addSubcommandGroup(subcommandGroup =>
            subcommandGroup
                .setName('gm')
                .setDescription('Game Master management')
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('request')
                        .setDescription('Request to become Game Master')
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('approve')
                        .setDescription('Approve a GM request (GM only)')
                        .addStringOption(option =>
                            option.setName('player')
                                .setDescription('Name or ID of the player to promote')
                                .setRequired(true)
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('status')
                        .setDescription('Show current GM and pending requests')
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('list')
                        .setDescription('List all connected clients and their roles')
                )
        ),

    async execute(interaction, client) {
        const subcommand = interaction.options.getSubcommand();
        const subcommandGroup = interaction.options.getSubcommandGroup();
        const vtt = client.vtt;

        // Handle GM subcommands
        if (subcommandGroup === 'gm') {
            await handleGMSubcommand(interaction, vtt, subcommand);
            return;
        }

        switch (subcommand) {
            case 'connect':
                await handleConnect(interaction, vtt);
                break;

            case 'disconnect':
                await handleDisconnect(interaction, vtt);
                break;

            case 'status':
                await handleStatus(interaction, vtt);
                break;

            case 'info':
                await handleInfo(interaction, vtt);
                break;

            case 'region':
                await handleRegion(interaction, vtt);
                break;

            case 'modules':
                await handleModules(interaction, vtt);
                break;
        }
    }
};

// ============================================================
// GM Subcommand Handlers
// ============================================================

async function handleGMSubcommand(interaction, vtt, subcommand) {
    await interaction.deferReply({ ephemeral: true });

    if (!vtt.connected) {
        return interaction.editReply('❌ Not connected to VTT server');
    }

    switch (subcommand) {
        case 'request': {
            vtt.requestGM();
            return interaction.editReply('👑 GM request sent. Waiting for current GM to approve.');
        }

        case 'approve': {
            const playerInput = interaction.options.getString('player');
            // Find client by ID or name (case-insensitive)
            const clientEntry = Array.from(vtt.clients.entries()).find(([id, client]) => 
                id === playerInput || client.name?.toLowerCase() === playerInput.toLowerCase() || client.data?.name?.toLowerCase() === playerInput.toLowerCase()
            );
            if (!clientEntry) {
                return interaction.editReply(`❌ Could not find player "${playerInput}" in the room. Use \`/vtt gm list\` to see available clients.`);
            }
            const [targetId, targetClient] = clientEntry;
            // Check if the target has a pending request
            const pending = vtt.pendingRequests.find(r => r.requesterId === targetId);
            if (!pending) {
                return interaction.editReply(`❌ ${targetClient.name || targetClient.data?.name || targetId} has not requested GM. They must use \`/vtt gm request\` first.`);
            }
            // Send approval to server
            vtt.approveGM(targetId);
            // Remove from pending list optimistically (server will also handle)
            vtt.pendingRequests = vtt.pendingRequests.filter(r => r.requesterId !== targetId);
            return interaction.editReply(`✅ Approved ${targetClient.name || targetClient.data?.name || targetId} as Game Master.`);
        }

        case 'status': {
            const gm = vtt.getCurrentGM();
            const gmName = gm ? (gm.name || gm.data?.name || gm.id) : 'None';
            const pending = vtt.getPendingGMRequests();
            const pendingNames = pending.map(r => r.requesterName).join(', ') || 'None';
            const embed = new EmbedBuilder()
                .setColor(0xd4af37)
                .setTitle('👑 GM Status')
                .addFields(
                    { name: 'Current GM', value: gmName, inline: true },
                    { name: 'Pending Requests', value: pendingNames, inline: true }
                )
                .setTimestamp();
            return interaction.editReply({ embeds: [embed] });
        }

        case 'list': {
            if (vtt.clients.size === 0) {
                return interaction.editReply('No clients in room.');
            }
            const clientList = Array.from(vtt.clients.values()).map(c => {
                const name = c.name || c.data?.name || c.id;
                const role = c.role || 'player';
                const isGM = c.id === vtt.gmId ? '👑 ' : '';
                const isSelf = c.id === vtt.clientId ? ' (you)' : '';
                return `${isGM}**${name}**${isSelf} — \`${role}\``;
            }).join('\n');
            const embed = new EmbedBuilder()
                .setColor(0x43b581)
                .setTitle(`👥 Clients in ${vtt.roomCode}`)
                .setDescription(clientList)
                .setFooter({ text: `Total: ${vtt.clients.size} clients` })
                .setTimestamp();
            return interaction.editReply({ embeds: [embed] });
        }

        default:
            return interaction.editReply('❌ Unknown GM subcommand.');
    }
}

// ============================================================
// Existing Handlers (unchanged, kept for completeness)
// ============================================================

async function handleConnect(interaction, vtt) {
    const room = interaction.options.getString('room');
    const serverUrl = interaction.options.getString('server');

    await interaction.deferReply();

    try {
        if (vtt.connected) {
            return interaction.editReply('🔌 Already connected to VTT server');
        }

        if (serverUrl) {
            vtt.config.serverUrl = serverUrl;
        }

        vtt.deck = { cards: [], history: [], offset: 0 };
        vtt.modules = [];
        vtt.defaultRegion = vtt.defaultRegion || 'Acasia';
        vtt.pendingMessages = [];

        vtt.connect(room || undefined);

        const timeout = setTimeout(() => {
            interaction.editReply('⏰ Connection timed out. Check server URL and room code.');
        }, 15000);

        const connectedHandler = () => {
            clearTimeout(timeout);
            vtt.removeListener('error', errorHandler);
            
            const embed = new EmbedBuilder()
                .setColor(0x43b581)
                .setTitle('✅ Connected to VTT Server')
                .addFields(
                    { name: '📡 Server', value: vtt.config.serverUrl, inline: true },
                    { name: '🏠 Room', value: vtt.roomCode || 'Not set', inline: true },
                    { name: '📍 Default Region', value: vtt.defaultRegion, inline: true }
                )
                .setTimestamp();

            interaction.editReply({ embeds: [embed] });
        };

        const errorHandler = (err) => {
            clearTimeout(timeout);
            vtt.removeListener('connected', connectedHandler);
            interaction.editReply(`❌ Connection failed: ${err.message}`);
        };

        vtt.once('connected', connectedHandler);
        vtt.once('error', errorHandler);

    } catch (err) {
        interaction.editReply(`❌ Error: ${err.message}`);
    }
}

async function handleDisconnect(interaction, vtt) {
    await interaction.deferReply();

    try {
        if (!vtt.connected) {
            return interaction.editReply('❌ Not connected to VTT server');
        }

        vtt.disconnect();
        vtt.deck = { cards: [], history: [], offset: 0 };
        vtt.modules = [];
        
        const embed = new EmbedBuilder()
            .setColor(0xf04747)
            .setTitle('🔌 Disconnected from VTT Server')
            .setDescription('Disconnected successfully.')
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    } catch (err) {
        interaction.editReply(`❌ Error: ${err.message}`);
    }
}

async function handleStatus(interaction, vtt) {
    await interaction.deferReply();

    const deckState = vtt.deck || { cards: [], history: [] };
    const modules = vtt.modules || [];
    const region = vtt.defaultRegion || 'Acasia';

    const embed = new EmbedBuilder()
        .setTitle('📊 VTT Connection Status')
        .setColor(vtt.connected ? 0x43b581 : 0xf04747)
        .addFields(
            { name: 'Status', value: vtt.connected ? '🟢 Connected' : '🔴 Disconnected', inline: true },
            { name: '📡 Server', value: vtt.config?.serverUrl || 'Not set', inline: true },
            { name: '🏠 Room', value: vtt.roomCode || 'Not set', inline: true },
            { name: '📍 Default Region', value: region, inline: true },
            { name: '🃏 Deck Cards', value: String(deckState.cards?.length || 0), inline: true },
            { name: '📜 Deck History', value: String(deckState.history?.length || 0), inline: true },
            { name: '📦 Modules Loaded', value: String(modules.length), inline: true },
            { name: '🔄 Reconnect Attempts', value: String(vtt.reconnectAttempts || 0), inline: true },
            { name: '📨 Pending Messages', value: String(vtt.pendingMessages?.length || 0), inline: true }
        )
        .setTimestamp();

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('vtt_refresh_status')
                .setLabel('🔄 Refresh')
                .setStyle(ButtonStyle.Secondary)
        );

    await interaction.editReply({ embeds: [embed], components: [row] });
}

async function handleInfo(interaction, vtt) {
    await interaction.deferReply();

    if (!vtt.connected) {
        return interaction.editReply('❌ Not connected to VTT server');
    }

    vtt.send('get-clients', {});

    const timeout = setTimeout(() => {
        interaction.editReply('⏰ No response from VTT server');
    }, 5000);

    vtt.once('room-state', (data) => {
        clearTimeout(timeout);

        const embed = new EmbedBuilder()
            .setTitle(`🏠 VTT Room: ${vtt.roomCode}`)
            .setColor(0xd4af37)
            .addFields(
                { name: '📊 Stats', value: `Clients: ${data.clients?.length || 0}\nChat Messages: ${data.chatHistory?.length || 0}\nDeck Cards: ${vtt.deck?.cards?.length || 0}`, inline: true },
                { name: '👥 Clients', value: data.clients?.map(c => `- ${c.data?.name || c.name || 'Unknown'}`).join('\n') || 'No clients', inline: true }
            )
            .setTimestamp();

        interaction.editReply({ embeds: [embed] });
    });
}

async function handleRegion(interaction, vtt) {
    const region = interaction.options.getString('region');

    await interaction.deferReply();

    try {
        if (!vtt.connected) {
            return interaction.editReply('❌ Not connected to VTT server');
        }

        vtt.defaultRegion = region;
        vtt.send('set-region', { region });

        const embed = new EmbedBuilder()
            .setColor(0x43b581)
            .setTitle('📍 Region Updated')
            .setDescription(`Default region set to: **${region}**`)
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    } catch (err) {
        interaction.editReply(`❌ Error: ${err.message}`);
    }
}

async function handleModules(interaction, vtt) {
    await interaction.deferReply();

    try {
        if (!vtt.connected) {
            return interaction.editReply('❌ Not connected to VTT server');
        }

        vtt.send('module-list', {});

        const modules = vtt.modules || [];
        
        if (modules.length === 0) {
            const embed = new EmbedBuilder()
                .setColor(0xd4af37)
                .setTitle('📦 Loaded Modules')
                .setDescription('No modules currently loaded.')
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });
        }

        const embed = new EmbedBuilder()
            .setColor(0xd4af37)
            .setTitle('📦 Loaded Modules')
            .setDescription(modules.map(m => 
                `**${m.name || m.id}** v${m.version || '1.0.0'}\n` +
                `  ${m.description || 'No description'}`
            ).join('\n\n'))
            .setFooter({ text: `Total: ${modules.length} modules` })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    } catch (err) {
        interaction.editReply(`❌ Error: ${err.message}`);
    }
}